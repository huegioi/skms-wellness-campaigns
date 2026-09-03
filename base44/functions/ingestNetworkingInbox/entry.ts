import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.162';
import {
  isTeamMember, stripHtml, ymd, zonedToIso, parseIcs, todayIsoNY,
  loadEventIndex, upsertCandidate,
} from '../../shared/networkingEvents.ts';

// ---------------------------------------------------------------------------
// ingestNetworkingInbox — the inbox channel of the Networking Events calendar.
// Reads william@ (Gmail connector), heather@ (Gmail OAuth refresh token in
// secrets) and admin@ (IMAP app password) for mail from each EventSource's
// sender_patterns, then:
//   • calendar invites (.ics / text/calendar) → parsed exactly, no LLM  → channel "invite"
//   • newsletters / announcements → LLM extraction that must quote the date text → "email"
// A per-account cursor lives in SyncState (label networking_inbox:<account>) so
// each message is looked at once. Runs from the "Daily Networking Inbox Sync"
// automation (body carries `automation`) or on demand ({ lookback_days, dry_run }).
// { action: 'extract_text', text, org_code } powers the "Add from text" dialog.
// ---------------------------------------------------------------------------

const LLM_MODEL = 'gpt_5_mini';
const MAX_BODY_CHARS = 12000;
const DEFAULT_LOOKBACK_DAYS = 3;

// ---- account access ---------------------------------------------------------
async function heatherAccessToken() {
  const clientId = Deno.env.get('HEATHER_GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('HEATHER_GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('HEATHER_GMAIL_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Heather token refresh failed (${res.status})`);
  return (await res.json()).access_token || null;
}

// ---- sender matching --------------------------------------------------------
const emailOf = (s = '') => (String(s).match(/<([^>]+)>/)?.[1] || String(s)).trim().toLowerCase();
function matchSource(fromAddr, sources) {
  const addr = emailOf(fromAddr); if (!addr) return null;
  const domain = addr.slice(addr.indexOf('@'));
  return sources.find(s => (s.sender_patterns || []).some(p => {
    const q = String(p).trim().toLowerCase(); if (!q) return false;
    return q.startsWith('@') ? domain === q || addr.endsWith(q) : addr === q;
  })) || null;
}
function gmailQueryFor(sources, afterEpochSec) {
  const terms = new Set();
  for (const s of sources) for (const p of s.sender_patterns || []) { const q = String(p).trim().toLowerCase(); if (q) terms.add(`from:${q.startsWith('@') ? q.slice(1) : q}`); }
  if (!terms.size) return null;
  return `(${[...terms].join(' OR ')}) after:${afterEpochSec}`;
}

// ---- MIME (IMAP) ------------------------------------------------------------
const b64ToText = (b64) => { try { const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')); return new TextDecoder('utf-8').decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))); } catch { return ''; } };
const qpToText = (s) => { const bytes = []; const t = s.replace(/=\r?\n/g, ''); for (let i = 0; i < t.length; i++) { if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) { bytes.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; } else bytes.push(t.charCodeAt(i) & 0xff); } try { return new TextDecoder('utf-8').decode(Uint8Array.from(bytes)); } catch { return t; } };
function parseHeaders(block) {
  const out = {}; const lines = block.replace(/\r\n?/g, '\n').split('\n'); let cur = null;
  for (const l of lines) { if (/^[ \t]/.test(l) && cur) out[cur] += ' ' + l.trim(); else { const i = l.indexOf(':'); if (i > 0) { cur = l.slice(0, i).toLowerCase(); out[cur] = (out[cur] ? out[cur] + ', ' : '') + l.slice(i + 1).trim(); } } }
  return out;
}
const decodeMimeWord = (s = '') => s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, data) => enc.toUpperCase() === 'B' ? b64ToText(data) : qpToText(data.replace(/_/g, ' ')));
// Returns a flat list of leaf parts: { type, filename, text }. Boundaries are case-sensitive.
function parseMime(raw) {
  const sep = raw.indexOf('\r\n\r\n') >= 0 ? '\r\n\r\n' : '\n\n';
  const i = raw.indexOf(sep); const headers = parseHeaders(i >= 0 ? raw.slice(0, i) : raw); const body = i >= 0 ? raw.slice(i + sep.length) : '';
  const ctRaw = headers['content-type'] || 'text/plain';
  const type = ctRaw.split(';')[0].trim().toLowerCase();
  const filename = decodeMimeWord((headers['content-disposition'] || '').match(/filename="?([^";]+)"?/i)?.[1] || ctRaw.match(/name="?([^";]+)"?/i)?.[1] || '');
  if (type.startsWith('multipart/')) {
    const boundary = ctRaw.match(/boundary="?([^";]+)"?/i)?.[1]; if (!boundary) return [];
    const chunks = body.split(new RegExp(`(?:^|\\r?\\n)--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?(?:\\r?\\n|$)`));
    return chunks.slice(1).filter(c => c.trim()).flatMap(parseMime);
  }
  const enc = (headers['content-transfer-encoding'] || '7bit').toLowerCase().trim();
  const text = enc === 'base64' ? b64ToText(body) : enc === 'quoted-printable' ? qpToText(body) : body;
  return [{ type, filename, text }];
}

// ---- Gmail API --------------------------------------------------------------
async function gmailFetch(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) { await new Promise(r => setTimeout(r, 2000)); return gmailFetch(url, token); }
  if (!res.ok) throw new Error(`Gmail ${res.status} for ${url.slice(0, 80)}`);
  return res.json();
}
async function gmailListMessages(token, query, max = 150) {
  const ids = []; let pageToken = null;
  do {
    const data = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`, token);
    for (const m of data.messages || []) ids.push(m.id);
    pageToken = data.nextPageToken; if (ids.length >= max) break;
  } while (pageToken);
  return ids.slice(0, max);
}
// Normalizes a Gmail "full" message into { id, from, subject, date, parts:[{type, filename, text}] }
async function gmailGetMessage(token, id) {
  const msg = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, token);
  const hdr = (n) => (msg.payload?.headers || []).find(h => h.name.toLowerCase() === n)?.value || '';
  const parts = [];
  const walk = async (p) => {
    if (!p) return;
    if (p.parts?.length) { for (const q of p.parts) await walk(q); return; }
    const type = (p.mimeType || '').toLowerCase(); const filename = p.filename || '';
    let text = '';
    if (p.body?.data) text = b64ToText(p.body.data);
    else if (p.body?.attachmentId && (type === 'text/calendar' || type === 'application/ics' || /\.ics$/i.test(filename))) {
      const att = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/attachments/${p.body.attachmentId}`, token);
      text = b64ToText(att.data || '');
    }
    parts.push({ type, filename, text });
  };
  await walk(msg.payload);
  return { id, from: hdr('from'), subject: hdr('subject'), date: new Date(Number(msg.internalDate || Date.now())), parts };
}

// ---- IMAP (admin@) ----------------------------------------------------------
async function imapMessages(account, password, sinceDate, senderMatcher, max = 150) {
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: account, pass: password }, logger: false });
  const out = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ since: sinceDate }, { uid: true });
      const recent = (uids || []).slice(-400);
      const wanted = [];
      if (recent.length) for await (const m of client.fetch(recent, { envelope: true, uid: true }, { uid: true })) {
        const from = m.envelope?.from?.[0]; const addr = from?.address || (from?.mailbox && from?.host ? `${from.mailbox}@${from.host}` : '');
        if (addr && senderMatcher(addr)) wanted.push({ uid: m.uid, from: addr, subject: m.envelope.subject || '', date: m.envelope.date ? new Date(m.envelope.date) : new Date() });
      }
      for (const w of wanted.slice(-max)) {
        const dl = await client.download(String(w.uid), undefined, { uid: true });
        const chunks = []; for await (const ch of dl.content) chunks.push(ch);
        const raw = new TextDecoder('utf-8').decode(new Uint8Array(chunks.reduce((a, c) => { const n = new Uint8Array(a.length + c.length); n.set(a); n.set(c, a.length); return n; }, new Uint8Array())));
        out.push({ id: `imap:${account}:${w.uid}`, from: w.from, subject: w.subject, date: w.date, parts: parseMime(raw) });
      }
    } finally { lock.release(); }
  } finally { try { await client.logout(); } catch (_) {} }
  return out;
}

// ---- message → candidates ---------------------------------------------------
function icsPartsOf(m) { return m.parts.filter(p => p.type === 'text/calendar' || p.type === 'application/ics' || /\.ics$/i.test(p.filename || '')).map(p => p.text).filter(t => /BEGIN:VEVENT/.test(t)); }
function bodyTextOf(m) {
  const plain = m.parts.find(p => p.type === 'text/plain')?.text || '';
  const html = m.parts.find(p => p.type === 'text/html')?.text || '';
  const text = (plain.length > 200 ? plain : stripHtml(html) || plain).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text.slice(0, MAX_BODY_CHARS);
}
// Cheap pre-filter so the LLM only sees mail that plausibly announces a dated event.
const looksLikeEventMail = (subject, text) => /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}\b/i.test(`${subject}\n${text}`) && /\b(register|registration|rsvp|join us|webinar|conference|summit|reception|networking|event|workshop|forum|save the date)\b/i.test(`${subject}\n${text}`);

function inviteCandidates(m, src) {
  const out = [];
  for (const ics of icsPartsOf(m)) {
    const cancelled = /^METHOD:CANCEL/m.test(ics);
    for (const e of parseIcs(ics)) {
      if (!e.title || !e.start) continue;
      const desc = (e.description || '').trim();
      const link = desc.match(/https?:\/\/[^\s>"')]+zoom[^\s>"')]*|https?:\/\/meet\.google\.com\/[^\s>"')]+|https?:\/\/teams\.microsoft\.com\/[^\s>"')]+/i)?.[0] || e.url || '';
      out.push({
        title: e.title.replace(/^(updated )?invitation:\s*/i, '').replace(/^\([^)]{1,20}\)\s*[-–—]?\s*/, '').replace(/\s*@ .*$/, '').replace(/\s+[-–—]\s*/g, ' — ').trim() || e.title,
        description: desc.slice(0, 1500), location: e.location, registration_url: link,
        start_date: e.start, end_date: e.end, all_day: e.allDay,
        source_uid: e.uid || undefined, raw_ref: `gmail:${m.id}`, confidence: 'high',
        quote: `ICS DTSTART (${m.subject.slice(0, 60)})`, _cancelled: cancelled || /cancel/i.test(e.status || ''),
      });
    }
  }
  return out;
}

async function llmCandidates(base44, m, src, text) {
  const today = todayIsoNY();
  const prompt = `Today is ${today}. Below is an email from ${src.org_name} (${src.full_name || ''}) sent to a member of the SkillfulMeans team.
Extract every UPCOMING event this email invites the reader to attend: webinars, conferences, receptions, networking meetings, workshops, forums. Rules:
- Only events with a specific calendar date on or after ${today}. Skip past events, registration deadlines, sponsorship deadlines, surveys, and events only mentioned in passing.
- date_quote MUST be the exact text from the email that states the date (for example "Wednesday, Sept. 16" or "October 13, 2026"). If you cannot quote it, do not invent a date — set start_date to "" instead.
- Times are US Eastern unless the email says otherwise. Use 24-hour HH:MM. Leave start_time empty when no time is given.
- format: "virtual" for Zoom/webinar/online, "in_person" when a venue or city is named, "hybrid" if both, else "unknown".
- registration_url: the link the email uses for registering or details, if any.
- Keep titles as written by the organizer, without the org name prefix.

SUBJECT: ${m.subject}

EMAIL:
${text}`;
  const schema = {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' }, start_date: { type: 'string', description: 'YYYY-MM-DD or empty' }, start_time: { type: 'string', description: 'HH:MM 24h or empty' },
            end_date: { type: 'string' }, end_time: { type: 'string' }, format: { type: 'string', enum: ['in_person', 'virtual', 'hybrid', 'unknown'] },
            venue: { type: 'string' }, city: { type: 'string' }, state: { type: 'string', description: 'two-letter US state or empty' },
            registration_url: { type: 'string' }, cost_text: { type: 'string' }, date_quote: { type: 'string' }, summary: { type: 'string', description: 'one sentence' },
          },
          required: ['title', 'start_date', 'date_quote'],
        },
      },
    },
    required: ['events'],
  };
  let res;
  try { res = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: LLM_MODEL, response_json_schema: schema }); }
  catch (e) { res = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema }); }
  const data = typeof res === 'string' ? (() => { try { return JSON.parse(res); } catch { return {}; } })() : (res || {});
  const out = [];
  for (const ev of data.events || []) {
    if (!ev?.title) continue;
    const sd = /^\d{4}-\d{2}-\d{2}$/.test(ev.start_date || '') ? ev.start_date : '';
    const quoted = (ev.date_quote || '').trim();
    // The date must be traceable to the email text — otherwise it's low confidence and reviewed.
    const quoteFound = quoted && `${m.subject}\n${text}`.toLowerCase().includes(quoted.toLowerCase().slice(0, 40));
    if (!sd) continue;
    const c = {
      title: ev.title.trim(), description: (ev.summary || '').slice(0, 500), format: ev.format || 'unknown',
      venue: ev.venue || '', city: ev.city || '', state: (ev.state || '').toUpperCase().slice(0, 2), registration_url: ev.registration_url || '', cost_text: ev.cost_text || '',
      all_day: !ev.start_time, raw_ref: `gmail:${m.id}`, confidence: quoteFound ? 'medium' : 'low',
      quote: quoted ? `email "${quoted.slice(0, 80)}"${quoteFound ? '' : ' (quote not found verbatim)'}` : 'email (no quote)',
    };
    if (ev.start_time && /^\d{1,2}:\d{2}$/.test(ev.start_time)) { c.start_date = zonedToIso(sd, ev.start_time); const ed = /^\d{4}-\d{2}-\d{2}$/.test(ev.end_date || '') ? ev.end_date : sd; c.end_date = zonedToIso(ed, /^\d{1,2}:\d{2}$/.test(ev.end_time || '') ? ev.end_time : ev.start_time); }
    else { c.start_date = sd; if (/^\d{4}-\d{2}-\d{2}$/.test(ev.end_date || '') && ev.end_date > sd) c.end_date = ev.end_date; }
    if (c.format === 'virtual') { c.region = 'Virtual'; c.venue = c.venue || ''; }
    out.push(c);
  }
  return out;
}

// ---- cursor -----------------------------------------------------------------
async function readCursor(db, account) {
  const rows = await db.SyncState.filter({ label: `networking_inbox:${account}` });
  return rows?.[0] || null;
}
async function writeCursor(db, account, existingRow, isoTs) {
  if (existingRow) await db.SyncState.update(existingRow.id, { page_token: isoTs });
  else await db.SyncState.create({ label: `networking_inbox:${account}`, page_token: isoTs });
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
  const { lookback_days, dry_run = false, accounts: onlyAccounts, ignore_cursor = false } = body;
  const db = base44.asServiceRole.entities;

  // "Add from text": run the same extractor on pasted email text / a page's text and return
  // candidates for the form — nothing is saved here.
  if (body.action === 'extract_text') {
    const text = String(body.text || '').slice(0, MAX_BODY_CHARS);
    if (!text.trim()) return Response.json({ error: 'No text provided' }, { status: 400 });
    const srcs = await db.EventSource.list('org_name', 200);
    const src = srcs.find(s => s.org_code === body.org_code) || { org_code: body.org_code || 'unknown', org_name: body.org_name || 'the organizer', full_name: '' };
    const m = { id: 'paste', subject: body.subject || '', parts: [] };
    const icsBlocks = text.includes('BEGIN:VEVENT') ? [{ type: 'text/calendar', filename: '', text }] : [];
    const candidates = icsBlocks.length ? inviteCandidates({ ...m, parts: icsBlocks }, src) : await llmCandidates(base44, m, src, text);
    for (const c of candidates) { delete c._cancelled; c.channel = icsBlocks.length ? 'invite' : 'email'; }
    return Response.json({ candidates });
  }
  const now = new Date();
  const todayIso = todayIsoNY();

  const allSources = await db.EventSource.list('org_name', 200);
  const sources = allSources.filter(s => s.is_active !== false && (s.sender_patterns || []).length);
  const index = await loadEventIndex(db);
  const report = { ran_at: now.toISOString(), accounts: [], created: 0, updated: 0, skipped: 0, dry_run };
  const senderMatcher = (addr) => !!matchSource(addr, sources);

  const accountPlans = [
    { label: 'william', kind: 'gmail', token: async () => (await base44.asServiceRole.connectors.getConnection('gmail')).accessToken },
    { label: 'heather', kind: 'gmail', token: heatherAccessToken },
    { label: 'admin', kind: 'imap', address: Deno.env.get('GMAIL_ADDRESS') || 'admin@skillfulmeans.life', password: () => Deno.env.get('GMAIL_ADMIN_PASSWORD') },
  ].filter(a => !onlyAccounts || onlyAccounts.includes(a.label));

  for (const acct of accountPlans) {
    const r = { account: acct.label, scanned: 0, invites: 0, llm_calls: 0, created: 0, updated: 0, skipped: 0, error: null, samples: [] };
    try {
      const cursorRow = ignore_cursor ? null : await readCursor(db, acct.label);
      const lookback = lookback_days || (cursorRow ? DEFAULT_LOOKBACK_DAYS : 30);
      let since = new Date(now.getTime() - lookback * 86400000);
      if (cursorRow?.page_token) { const c = new Date(cursorRow.page_token); if (!isNaN(c.getTime()) && c > since) since = new Date(c.getTime() - 3600000); }
      let messages = [];
      if (acct.kind === 'gmail') {
        const token = await acct.token(); if (!token) throw new Error('No access token');
        const q = gmailQueryFor(sources, Math.floor(since.getTime() / 1000)); if (!q) throw new Error('No sender patterns configured');
        const ids = await gmailListMessages(token, q);
        for (const id of ids) messages.push(await gmailGetMessage(token, id));
      } else {
        const pw = acct.password(); if (!pw) throw new Error('No IMAP password in secrets');
        messages = await imapMessages(acct.address, pw, since, senderMatcher);
      }
      messages = messages.filter(m => m.date > since).sort((a, b) => a.date - b.date);
      let newest = cursorRow?.page_token ? new Date(cursorRow.page_token) : since;
      for (const m of messages) {
        r.scanned++;
        const src = matchSource(m.from, sources); if (!src) { r.skipped++; continue; }
        let candidates = inviteCandidates(m, src);
        let channel = 'invite';
        if (candidates.length) r.invites++;
        else {
          const text = bodyTextOf(m);
          if (!looksLikeEventMail(m.subject, text)) { r.skipped++; if (m.date > newest) newest = m.date; continue; }
          r.llm_calls++;
          try { candidates = await llmCandidates(base44, m, src, text); } catch (e) { candidates = []; r.samples.push(`llm error: ${String(e?.message || e).slice(0, 120)}`); }
          channel = 'email';
        }
        for (const c of candidates) {
          if (c._cancelled) {
            const match = index.findMatch(src.org_code, c);
            if (match && !match._crossOrg && !dry_run) await db.NetworkingEvent.update(match.id, { status: 'rejected', notes: `${match.notes ? match.notes + ' · ' : ''}Cancelled by organizer (${ymd(now)})` });
            r.skipped++; continue;
          }
          const outcome = await upsertCandidate(db, src, c, index, { dry_run, channel, todayIso });
          r[outcome]++; report[outcome]++;
          if (r.samples.length < 8) r.samples.push(`${outcome}: ${src.org_code} · ${c.title} · ${(c.start_date || '').slice(0, 16)} · ${c.confidence}`);
        }
        if (m.date > newest) newest = m.date;
      }
      if (!dry_run && messages.length) await writeCursor(db, acct.label, cursorRow, newest.toISOString());
    } catch (err) {
      r.error = String(err?.message || err);
    }
    report.accounts.push(r);
  }
  // Stamp the sources that have inbox channels so the panel shows they were checked.
  if (!dry_run) for (const s of sources.filter(s => ['email', 'invite'].includes(s.channel) || ['email', 'invite'].includes(s.fallback_channel))) {
    await db.EventSource.update(s.id, { last_polled_at: now.toISOString(), last_error: '' });
  }
  return Response.json(report);
});
