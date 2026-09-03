import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  isTeamMember, stripHtml, decodeEntities, fetchText, parseIcs, zonedToIso, todayIsoNY,
  loadEventIndex, upsertCandidate, archivePastEvents,
} from '../../shared/networkingEvents.ts';

// ---------------------------------------------------------------------------
// ingestNetworkingPages — the page-scraper channel of the Networking Events
// calendar, for the orgs that publish no feed: NEEBC, NABIP national, NABIP-NY,
// CT SHRM, NY SHRM, NYC SHRM, NEBGH, SIIA, WWCMA, Health Rosetta webinars,
// SHRM national, NH SHRM, Boston Chamber, FMMA.
//
// Cost control (agreed with William 2026-09-03): the page text is hashed and the
// hash kept in SyncState (label `networking_page:<org_code>`). When a page is
// unchanged since the last visit the LLM is never called — most days that means
// zero model calls. Every extracted date must be quoted from the page text, and
// the quote is verified verbatim; unverified ⇒ low confidence ⇒ review queue.
//
// NEEBC extra: its JEvents pages expose a per-event ICS
// (index.php?option=com_jevents&task=icals.icalevent&evid=N), so after the LLM
// finds an event we try that ICS for exact times.
//
// Body: { source_id?, org_code?, force?, dry_run?, budget_seconds?, max_llm_calls? }
// Scheduled runs carry `automation` in the body.
// ---------------------------------------------------------------------------

const LLM_MODEL = 'gpt_5_mini';
const MAX_PAGE_CHARS = 14000;
const DEFAULT_POLL_DAYS = 3;
const SCRAPE_CHANNELS = new Set(['scrape']);

// ---- page text --------------------------------------------------------------
// Strip scripts/styles/nav chrome, then collapse to readable text. Keep hrefs of
// links whose text looks like an event so the model can return a registration URL.
function pageToText(html, baseUrl) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(header|footer|nav)[\s\S]*?<\/\1>/gi, ' ');
  // Turn <a href="x">text</a> into "text <x>" so links survive the strip.
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const text = stripHtml(inner).trim();
    if (!text) return ' ';
    let abs = href;
    try { abs = new URL(decodeEntities(href), baseUrl).toString(); } catch (_) {}
    return /^(#|javascript:|mailto:)/i.test(href) ? ` ${text} ` : ` ${text} <${abs}> `;
  });
  return stripHtml(s).replace(/\n{3,}/g, '\n\n').slice(0, MAX_PAGE_CHARS);
}

// FNV-1a — small, stable, no crypto import needed.
function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
// The parts of a page that change every visit (session ids, timestamps, view counts)
// would defeat the hash, so normalize the obvious ones away before hashing.
const hashableText = (t) => hashText(t
  .replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/gi, '')
  .replace(/\b(19|20)\d{2}-\d{2}-\d{2}T[\d:.]+Z?\b/g, '')
  .replace(/[?&](sid|token|_|cb|v)=[^\s&<>"']+/gi, '')
  .replace(/\s+/g, ' ')
  .trim());

// ---- state ------------------------------------------------------------------
async function readPageState(db, orgCode) {
  const rows = await db.SyncState.filter({ label: `networking_page:${orgCode}` });
  const row = rows?.[0] || null;
  let state = { hash: null, checked: null };
  if (row?.page_token) { try { const p = JSON.parse(row.page_token); if (p && typeof p === 'object') state = { hash: p.hash || null, checked: p.checked || null }; } catch { state.hash = row.page_token; } }
  return { row, state };
}
async function writePageState(db, orgCode, row, state) {
  const token = JSON.stringify(state);
  if (row) await db.SyncState.update(row.id, { page_token: token });
  else await db.SyncState.create({ label: `networking_page:${orgCode}`, page_token: token });
}

// ---- extraction -------------------------------------------------------------
const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_date: { type: 'string', description: 'YYYY-MM-DD, or empty if the page gives no specific date' },
          start_time: { type: 'string', description: 'HH:MM 24-hour, or empty' },
          end_date: { type: 'string' }, end_time: { type: 'string' },
          format: { type: 'string', enum: ['in_person', 'virtual', 'hybrid', 'unknown'] },
          venue: { type: 'string' }, city: { type: 'string' }, state: { type: 'string', description: 'two-letter US state or empty' },
          registration_url: { type: 'string' }, cost_text: { type: 'string' },
          date_quote: { type: 'string', description: 'the exact text from the page that states the date' },
          summary: { type: 'string', description: 'one sentence' },
        },
        required: ['title', 'start_date', 'date_quote'],
      },
    },
  },
  required: ['events'],
};

async function extractFromPage(base44, src, text) {
  const today = todayIsoNY();
  const prompt = `Today is ${today}. Below is the text of ${src.org_name}'s events page (${src.full_name || src.org_name}), with link targets shown in angle brackets after the link text.
List every UPCOMING event the page advertises: conferences, webinars, meetings, receptions, forums, CE days, workshops. Rules:
- Only events dated on or after ${today}. Skip past events, application deadlines, membership renewals, and navigation items.
- date_quote MUST be text copied exactly from the page that states the date (e.g. "October 22, 2026" or "Wed, Oct 22"). If the page does not state a date for an event, set start_date to "" and skip it.
- If the page shows a date with no year, infer the year that makes the event fall on or after ${today}, but still quote the text as printed.
- Times are US Eastern unless stated. Use 24-hour HH:MM. Leave start_time empty if no time is given.
- format: "virtual" for webinar/online/Zoom, "in_person" when a venue or city appears, "hybrid" if both, else "unknown".
- registration_url: the <link> nearest that event, when there is one.
- One entry per event. Do NOT split an event's agenda items (reception, breakfast, breakout) into separate events.
- Keep the organizer's own titles; do not prefix them with the org name.

PAGE:
${text}`;
  let res;
  try { res = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: LLM_MODEL, response_json_schema: EXTRACT_SCHEMA }); }
  catch (_) { res = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: EXTRACT_SCHEMA }); }
  const data = typeof res === 'string' ? (() => { try { return JSON.parse(res); } catch { return {}; } })() : (res || {});
  const out = [];
  const haystack = text.toLowerCase();
  for (const ev of data.events || []) {
    if (!ev?.title) continue;
    const sd = /^\d{4}-\d{2}-\d{2}$/.test(ev.start_date || '') ? ev.start_date : '';
    if (!sd) continue;
    const quoted = (ev.date_quote || '').trim();
    const quoteFound = quoted && haystack.includes(quoted.toLowerCase().slice(0, 40));
    const c = {
      title: ev.title.trim(), description: (ev.summary || '').slice(0, 500), format: ev.format || 'unknown',
      venue: ev.venue || '', city: ev.city || '', state: (ev.state || '').toUpperCase().slice(0, 2),
      registration_url: ev.registration_url || '', cost_text: ev.cost_text || '',
      all_day: !ev.start_time, raw_ref: src.page_url, confidence: quoteFound ? 'medium' : 'low',
      quote: quoted ? `page "${quoted.slice(0, 80)}"${quoteFound ? '' : ' (quote not found verbatim)'}` : 'page (no quote)',
    };
    if (ev.start_time && /^\d{1,2}:\d{2}$/.test(ev.start_time)) {
      c.start_date = zonedToIso(sd, ev.start_time);
      const ed = /^\d{4}-\d{2}-\d{2}$/.test(ev.end_date || '') ? ev.end_date : sd;
      c.end_date = zonedToIso(ed, /^\d{1,2}:\d{2}$/.test(ev.end_time || '') ? ev.end_time : ev.start_time);
    } else {
      c.start_date = sd;
      if (/^\d{4}-\d{2}-\d{2}$/.test(ev.end_date || '') && ev.end_date > sd) c.end_date = ev.end_date;
    }
    if (c.format === 'virtual') c.region = 'Virtual';
    out.push(c);
  }
  return out;
}

// NEEBC publishes a per-event ICS; when the scraped registration link carries an
// evid we can upgrade the guessed time to the published one.
async function enrichNeebc(c) {
  const evid = (c.registration_url || '').match(/evid=(\d+)/)?.[1];
  if (!evid) return;
  try {
    const ics = await fetchText(`https://www.neebc.org/index.php?option=com_jevents&task=icals.icalevent&template=component&evid=${evid}&Itemid=128`, 'text/calendar, */*;q=0.5');
    const ev = parseIcs(ics)[0];
    if (ev?.start && ev.start.slice(0, 10) === (c.start_date || '').slice(0, 10)) {
      c.start_date = ev.start; if (ev.end) c.end_date = ev.end; c.all_day = ev.allDay;
      if (ev.location) c.location = ev.location;
      c.confidence = 'high'; c.quote += ' + per-event ICS';
    }
  } catch (_) { /* keep the scraped date */ }
}

// ---- main -------------------------------------------------------------------
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let body = {}; try { body = await req.clone().json(); } catch (_) {}
  const isScheduled = !!body.automation;
  if (!isScheduled) {
    let user = null; try { user = await base44.auth.me(); } catch (_) {}
    if (!user || !isTeamMember(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { source_id, org_code, force = false, dry_run = false } = body;
  const budgetMs = Math.min(Math.max(Number(body.budget_seconds) || (isScheduled ? 240 : 100), 20), 270) * 1000;
  const maxLlm = Math.max(Number(body.max_llm_calls) || 12, 1);
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > budgetMs;
  const db = base44.asServiceRole.entities;
  const now = new Date();
  const todayIso = todayIsoNY();

  let sources = await db.EventSource.list('org_name', 200);
  sources = sources.filter(s => s.is_active !== false && SCRAPE_CHANNELS.has(s.channel) && s.page_url);
  if (source_id) sources = sources.filter(s => s.id === source_id);
  if (org_code) sources = sources.filter(s => s.org_code === org_code);
  if (!force) sources = sources.filter(s => !s.last_polled_at || (now.getTime() - new Date(s.last_polled_at).getTime()) >= ((s.poll_every_days || DEFAULT_POLL_DAYS) * 86400000 - 3600000));

  const index = await loadEventIndex(db);
  const report = { ran_at: now.toISOString(), sources: [], created: 0, updated: 0, skipped: 0, unchanged: 0, llm_calls: 0, more: false, dry_run };

  for (const src of sources) {
    if (outOfTime() || report.llm_calls >= maxLlm) { report.more = true; break; }
    const r = { org: src.org_code, found: 0, created: 0, updated: 0, skipped: 0, unchanged: false, error: null, samples: [] };
    try {
      const html = await fetchText(src.page_url, 'text/html, application/xhtml+xml, */*;q=0.5');
      const text = pageToText(html, src.page_url);
      const { row, state } = await readPageState(db, src.org_code);
      const hash = hashableText(text);
      if (!force && state.hash === hash) {
        r.unchanged = true; report.unchanged++;
        if (!dry_run) { await writePageState(db, src.org_code, row, { hash, checked: now.toISOString() }); await db.EventSource.update(src.id, { last_polled_at: now.toISOString(), last_error: '' }); }
        report.sources.push(r); continue;
      }
      if (text.length < 200) throw new Error(`Page returned only ${text.length} characters of text — likely blocked or JS-rendered`);
      report.llm_calls++;
      const candidates = await extractFromPage(base44, src, text);
      r.found = candidates.length;
      for (const c of candidates) {
        if (src.org_code === 'neebc') await enrichNeebc(c);
        const outcome = await upsertCandidate(db, src, c, index, { dry_run, channel: 'scrape', todayIso });
        r[outcome]++; report[outcome]++;
        if (r.samples.length < 8) r.samples.push(`${outcome}: ${c.title} · ${(c.start_date || '').slice(0, 16)} · ${c.confidence}`);
      }
      if (!dry_run) {
        await writePageState(db, src.org_code, row, { hash, checked: now.toISOString() });
        await db.EventSource.update(src.id, { last_polled_at: now.toISOString(), last_error: '', ...(r.created + r.updated ? { last_success_at: now.toISOString() } : {}) });
      }
    } catch (err) {
      r.error = String(err?.message || err);
      if (!dry_run) await db.EventSource.update(src.id, { last_polled_at: now.toISOString(), last_error: r.error });
    }
    report.sources.push(r);
  }

  if (!source_id && !org_code && !report.more) report.archived = await archivePastEvents(db, index, { dry_run, todayIso });
  report.elapsed_seconds = Math.round((Date.now() - startedAt) / 1000);
  return Response.json(report);
});
