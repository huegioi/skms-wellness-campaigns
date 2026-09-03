import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  isTeamMember, FEED_CHANNELS, DAY_MS, stripHtml, tag, pad, ymd,
  tzOffsetMinutes, zonedToIso, parseClock, findTextDates, todayMinus, fetchText, parseIcs,
  todayIsoNY, loadEventIndex, upsertCandidate, archivePastEvents,
} from '../../shared/networkingEvents.ts';

// ---------------------------------------------------------------------------
// ingestNetworkingEvents — daily job that fills the Networking Events calendar
// from each EventSource's FEED (RSS / ICS / JSON). Inbox channels live in
// ingestNetworkingInbox; page scrapers arrive in Phase 4. Runs as a Base44
// scheduled automation ("Daily Networking Events Sync", body carries
// `automation`) or on demand from the Sources panel ({ source_id, force }).
//
// Design rules (agreed with William 2026-09-03):
//   - feeds never call the LLM; dates come from structured fields only
//   - exact channel wins on dedupe; status/intent/owner/notes are never overwritten
//   - rejected rows are tombstones; auto_approve sources land as approved
// Shared parsing + dedupe: base44/shared/networkingEvents.ts
// ---------------------------------------------------------------------------

// ---- RSS --------------------------------------------------------------------
function splitItems(xml) {
  const items = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi; let m;
  while ((m = re.exec(xml))) items.push(m[1]);
  if (!items.length) { const re2 = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi; while ((m = re2.exec(xml))) items.push(m[1]); }
  return items;
}
function detectPlatform(xml, source) {
  const head = xml.slice(0, 4000).toLowerCase();
  if (xml.includes('<mec:startDate>')) return 'mec';
  if (head.includes('wild apricot') || (source.feed_url || '').includes('wildapricot')) return 'wildapricot';
  if (head.includes('squarespace') || /<link>https?:\/\/[^<]+\/events\/\d{4}\/\d{1,2}\/\d{1,2}\//i.test(xml)) return 'squarespace';
  if ((source.feed_url || '').includes('ymaws') || (source.feed_url || '').includes('site-ym')) return 'yourmembership';
  return 'generic';
}

// Turn one RSS item into a candidate event (or null when it isn't an event).
async function rssItemToCandidate(itemXml, platform, source) {
  const title = tag(itemXml, 'title');
  const link = tag(itemXml, 'link') || (itemXml.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
  const guid = tag(itemXml, 'guid') || link;
  const pubDate = tag(itemXml, 'pubDate') || tag(itemXml, 'published') || tag(itemXml, 'updated');
  const descHtml = tag(itemXml, 'content:encoded') || tag(itemXml, 'description') || tag(itemXml, 'content') || tag(itemXml, 'summary');
  const desc = stripHtml(descHtml);
  const c = { source_uid: guid, title: title.replace(/\s+\(\d{1,2} \w{3} \d{4}\)\s*$/, '').trim(), registration_url: link, description: desc.slice(0, 1500), raw_ref: link, confidence: 'high', all_day: true, quote: '' };
  if (!c.title) return null;

  if (platform === 'mec') {
    const sd = tag(itemXml, 'mec:startDate'), ed = tag(itemXml, 'mec:endDate');
    const sh = parseClock(tag(itemXml, 'mec:startHour')), eh = parseClock(tag(itemXml, 'mec:endHour'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) return null;
    if (sh) { c.start_date = zonedToIso(sd, sh); c.all_day = false; c.end_date = zonedToIso(ed || sd, eh || sh); }
    else { c.start_date = sd; if (ed && ed !== sd) c.end_date = ed; }
    const loc = tag(itemXml, 'mec:location'); if (loc) c.location = loc;
    c.quote = `mec:startDate ${sd} ${tag(itemXml, 'mec:startHour')}`;
    return c;
  }
  if (platform === 'wildapricot' || platform === 'yourmembership') {
    // pubDate IS the event start on these platforms.
    const d = pubDate ? new Date(pubDate) : null;
    if (!d || isNaN(d.getTime())) return null;
    const off = tzOffsetMinutes('America/New_York', d);
    const local = new Date(d.getTime() + off * 60000);
    const dayIso = ymd(local);
    const hh = local.getUTCHours(), mm = local.getUTCMinutes();
    if (hh === 0 && mm === 0) { c.start_date = dayIso; }
    else { c.start_date = zonedToIso(dayIso, `${pad(hh)}:${pad(mm)}`); c.all_day = false; }
    c.quote = `pubDate ${pubDate}`;
    // Wild Apricot descriptions often carry "Time: 8:00 AM - 4:00 PM" and a Location block.
    const tm = desc.match(/Time:\s*([0-9:]+\s*[ap]\.?m\.?)\s*[-–]\s*([0-9:]+\s*[ap]\.?m\.?)/i);
    if (tm) { const s = parseClock(tm[1]), e = parseClock(tm[2]); if (s && e) { c.start_date = zonedToIso(dayIso, s); c.end_date = zonedToIso(dayIso, e); c.all_day = false; } }
    else if (!c.all_day) { c.end_date = zonedToIso(dayIso, `${pad(Math.min(hh + 2, 23))}:${pad(mm)}`); }
    const lm = desc.match(/Location:\s*\n?([^\n]+)\n([^\n]+)\n?([^\n]*)/i);
    if (lm) c.location = [lm[1], lm[2], lm[3]].map(s => s.trim()).filter(Boolean).join(', ');
    return c;
  }
  if (platform === 'squarespace') {
    const m = link.match(/\/events\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
    if (!m) return null;
    const urlDay = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    c.start_date = urlDay; c.quote = `link path ${m[0]}`;
    // Explicit dates written in the post ("Dates: October 13, 2026 - Oct 15, 2026") beat the
    // URL date — MA SHRM sometimes files a conference under the day it was posted.
    const textDates = findTextDates(desc).map(x => x.iso).filter(x => x >= todayMinus(1)).sort();
    if (textDates.length && textDates[0] !== urlDay) { c.start_date = textDates[0]; c.confidence = 'medium'; c.quote = `text "${findTextDates(desc)[0].quote}"`; }
    if (textDates.length && textDates[textDates.length - 1] > c.start_date) c.end_date = textDates[textDates.length - 1];
    // Exact times from the per-event ICS Squarespace publishes at <link>?format=ical
    try {
      const ics = await fetchText(`${link}${link.includes('?') ? '&' : '?'}format=ical`, 'text/calendar, */*;q=0.5');
      const ev = parseIcs(ics)[0];
      if (ev && ev.start && ev.start.slice(0, 10) === c.start_date.slice(0, 10)) { c.start_date = ev.start; c.end_date = ev.end || c.end_date; c.all_day = ev.allDay; if (ev.location) c.location = ev.location; c.quote += ' + ICS'; c.confidence = 'high'; }
    } catch (_) { /* fine — keep the date we have */ }
    return c;
  }
  // Generic RSS: the only trustworthy thing is a date quoted in the title/description.
  const dates = findTextDates(`${title} ${desc}`);
  if (!dates.length) { c.start_date = undefined; c.confidence = 'low'; return c; }
  c.start_date = dates[0].iso; c.quote = dates[0].quote; c.confidence = 'medium';
  const later = dates.map(x => x.iso).filter(x => x > dates[0].iso).sort();
  if (later.length) c.end_date = later[later.length - 1];
  return c;
}

// ---- JSON (WordPress MEC REST) --------------------------------------------
async function jsonToCandidates(text, source) {
  let data; try { data = JSON.parse(text); } catch { throw new Error('Feed is not valid JSON'); }
  const arr = Array.isArray(data) ? data : (data.events || data.items || []);
  const out = [];
  for (const it of arr) {
    const title = stripHtml(it.title?.rendered || it.title || '');
    const link = it.link || it.url || '';
    if (!title) continue;
    const c = { source_uid: it.guid?.rendered || link || String(it.id), title, registration_url: link, description: stripHtml(it.excerpt?.rendered || it.content?.rendered || it.description || '').slice(0, 1500), raw_ref: link, confidence: 'medium', all_day: true, quote: '' };
    const start = it.start_date || it.startDate || it.mec?.start_date || it.meta?.mec_start_date;
    if (start && /^\d{4}-\d{2}-\d{2}/.test(String(start))) { c.start_date = String(start).slice(0, 10); c.quote = `start_date ${start}`; c.confidence = 'high'; }
    else { const d = findTextDates(c.description); if (d.length) { c.start_date = d[0].iso; c.quote = d[0].quote; } else c.confidence = 'low'; }
    out.push(c);
  }
  return out;
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
  const db = base44.asServiceRole.entities;
  const now = new Date();
  const todayIso = todayIsoNY();

  let sources = await db.EventSource.list('org_name', 200);
  sources = sources.filter(s => s.is_active !== false && FEED_CHANNELS.has(s.channel) && s.feed_url);
  if (source_id) sources = sources.filter(s => s.id === source_id);
  if (org_code) sources = sources.filter(s => s.org_code === org_code);
  if (!force) sources = sources.filter(s => !s.last_polled_at || (now.getTime() - new Date(s.last_polled_at).getTime()) >= ((s.poll_every_days || 1) * DAY_MS - 3600000));

  const index = await loadEventIndex(db);
  const report = { ran_at: now.toISOString(), sources: [], created: 0, updated: 0, skipped: 0, archived: 0, dry_run };

  for (const src of sources) {
    const r = { org: src.org_code, channel: src.channel, found: 0, created: 0, updated: 0, skipped: 0, error: null };
    let candidates = [];
    try {
      const text = await fetchText(src.feed_url);
      if (src.channel === 'feed_ics') candidates = parseIcs(text).map(e => ({ source_uid: e.uid || e.url, title: e.title, description: (e.description || '').slice(0, 1500), location: e.location, registration_url: e.url, raw_ref: src.feed_url, start_date: e.start, end_date: e.end, all_day: e.allDay, confidence: 'high', quote: 'ICS DTSTART' }));
      else if (src.channel === 'feed_json') candidates = await jsonToCandidates(text, src);
      else {
        const platform = detectPlatform(text, src);
        for (const item of splitItems(text)) { const c = await rssItemToCandidate(item, platform, src); if (c) candidates.push(c); }
        r.platform = platform;
      }
    } catch (err) {
      r.error = String(err?.message || err);
      report.sources.push(r);
      if (!dry_run) await db.EventSource.update(src.id, { last_polled_at: now.toISOString(), last_error: r.error });
      continue;
    }
    r.found = candidates.length;
    for (const c of candidates) {
      const outcome = await upsertCandidate(db, src, c, index, { dry_run, todayIso });
      r[outcome]++; report[outcome]++;
    }
    report.sources.push(r);
    const touched = r.created + r.updated;
    if (!dry_run) await db.EventSource.update(src.id, { last_polled_at: now.toISOString(), last_error: '', ...(touched ? { last_success_at: now.toISOString() } : {}) });
  }

  if (!source_id && !org_code) report.archived = await archivePastEvents(db, index, { dry_run, todayIso });
  return Response.json(report);
});
