import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ---------------------------------------------------------------------------
// ingestNetworkingEvents — daily job that fills the Networking Events calendar
// from each EventSource's feed. Phase 2 covers the feed channels (RSS / ICS /
// JSON); Phase 3 adds inbox (email + calendar-invite) and Phase 4 the page
// scrapers. Runs as a Base44 scheduled automation (body carries `automation`)
// or on demand from the Sources panel ("Check now" → { source_id, force }).
//
// Design rules (agreed with William 2026-09-03):
//   - feeds never call the LLM; dates come from structured fields only
//   - exact channel wins on dedupe: an existing row is updated in place, but
//     status / intent / owner / notes / opportunity are never overwritten
//   - rejected rows are tombstones — a re-fetch never resurrects them
//   - auto_approve sources land as approved; everything else pending_review
//   - anything with a missing/ambiguous date → confidence low → pending_review
// ---------------------------------------------------------------------------

const TEAM_EMAILS = (Deno.env.get('TEAM_EMAILS') || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || '').toLowerCase()));
const UA = 'Mozilla/5.0 (compatible; SkillfulMeans events sync; +https://skillfulmeans.life)';
const FEED_CHANNELS = new Set(['feed_rss', 'feed_json', 'feed_ics']);
const DAY_MS = 86400000;

// ---- small utilities --------------------------------------------------------
const decodeEntities = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&#8217;/g, '’').replace(/&#8220;/g, '“').replace(/&#8221;/g, '”').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
  .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&');
const stripHtml = (s = '') => decodeEntities(s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]).trim() : '';
};
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Offset (minutes) of an IANA zone at a given UTC instant, via Intl.
function tzOffsetMinutes(tz, atUtc) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(atUtc).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - atUtc.getTime()) / 60000);
}
// "2026-10-13" + "17:30" in America/New_York → ISO instant with the right offset.
function zonedToIso(dateStr, timeStr, tz = 'America/New_York') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  let off = tzOffsetMinutes(tz, guess);
  let inst = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffsetMinutes(tz, inst);
  if (off2 !== off) { off = off2; inst = new Date(guess.getTime() - off * 60000); }
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${dateStr}T${pad(hh)}:${pad(mm)}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
// "5:30 pm" / "17:30" / "8:00 AM" → "17:30"
function parseClock(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]); const mi = Number(m[2] || 0);
  const ap = (m[3] || '').toLowerCase();
  if (ap.startsWith('p') && h < 12) h += 12;
  if (ap.startsWith('a') && h === 12) h = 0;
  return `${pad(h)}:${pad(mi)}`;
}
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
// Find "October 13, 2026" / "Oct 15 2026" / "13 Oct 2026" style dates in free text.
function findTextDates(text) {
  const out = [];
  const re1 = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g;
  const re2 = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/g;
  let m;
  while ((m = re1.exec(text))) { const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()]; if (mo) out.push({ iso: `${m[3]}-${pad(mo)}-${pad(+m[2])}`, quote: m[0] }); }
  while ((m = re2.exec(text))) { const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()]; if (mo) out.push({ iso: `${m[3]}-${pad(mo)}-${pad(+m[1])}`, quote: m[0] }); }
  return out;
}
const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'at', 'with', 'our', 'your', 'annual', 'event', 'events', 'conference', 'nehra', 'shrm', 'nabip', 'ct', 'ma', 'ri', 'ny', 'nyc', 'neebc', 'wwcma', 'hvba', 'siia', 'well']);
const tokens = (s = '') => new Set(s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t) && !/^\d{4}$/.test(t)));
function titleSimilarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return slug(a).replace(/-?\d{4}(?=-|$)/g, '') === slug(b).replace(/-?\d{4}(?=-|$)/g, '') ? 1 : 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
const todayMinus = (days) => { const d = new Date(Date.now() - days * DAY_MS); return ymd(d); };
const slug = (s = '') => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const fingerprintOf = (org, title, dayIso) => `${org}|${slug(title)}|${dayIso}`;

// ---- fetch helpers ----------------------------------------------------------
async function fetchText(url, accept = 'application/rss+xml, application/xml, text/xml, text/calendar, application/json, text/html;q=0.8, */*;q=0.5') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': accept }, redirect: 'follow', signal: ctrl.signal });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return body;
  } finally { clearTimeout(t); }
}

// ---- ICS --------------------------------------------------------------------
// Minimal VEVENT parser: unfolds lines, reads DTSTART/DTEND (DATE, TZID, UTC),
// SUMMARY, LOCATION, URL, UID, DESCRIPTION. Enough for per-event ICS files.
function parseIcs(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const unfolded = [];
  for (const l of lines) { if (/^[ \t]/.test(l) && unfolded.length) unfolded[unfolded.length - 1] += l.slice(1); else unfolded.push(l); }
  const events = []; let cur = null;
  for (const raw of unfolded) {
    if (raw === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (raw === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = raw.indexOf(':'); if (i < 0) continue;
    const head = raw.slice(0, i); const val = raw.slice(i + 1);
    const [name, ...params] = head.split(';');
    const p = Object.fromEntries(params.map(x => x.split('=')));
    cur[name] = { value: val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';'), params: p };
  }
  const toDate = (f) => {
    if (!f) return null;
    const v = f.value;
    if (f.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { iso: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, allDay: true };
    const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
    if (!m) return null;
    const dateStr = `${m[1]}-${m[2]}-${m[3]}`, time = `${m[4]}:${m[5]}`;
    if (m[7] === 'Z') return { iso: `${dateStr}T${time}:${m[6] || '00'}Z`, allDay: false };
    const tz = f.params.TZID || 'America/New_York';
    try { return { iso: zonedToIso(dateStr, time, tz), allDay: false }; } catch { return { iso: zonedToIso(dateStr, time), allDay: false }; }
  };
  return events.map(e => {
    const s = toDate(e.DTSTART), en = toDate(e.DTEND);
    let endIso = en?.iso;
    // All-day DTEND is exclusive in iCalendar; make it inclusive for display.
    if (s?.allDay && en?.allDay && endIso) { const d = new Date(endIso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); endIso = ymd(d); if (endIso === s.iso) endIso = undefined; }
    return {
      uid: e.UID?.value, title: e.SUMMARY?.value?.trim(), description: e.DESCRIPTION?.value?.trim(),
      location: e.LOCATION?.value?.trim(), url: e.URL?.value?.trim(),
      start: s?.iso, end: endIso, allDay: !!s?.allDay,
    };
  }).filter(e => e.title && e.start);
}

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

// ---- location → venue/city/state/format ------------------------------------
function applyLocation(c, source) {
  const loc = c.location || '';
  const lower = `${c.title} ${loc} ${c.description || ''}`.toLowerCase();
  const virtual = /\b(zoom|webinar|virtual|online|teams|google meet)\b/.test(lower) && !/\b(in[- ]person)\b/.test(lower);
  if (virtual) { c.format = 'virtual'; c.region = 'Virtual'; c.venue = c.venue || (/(zoom|teams|google meet)/i.exec(loc)?.[0]) || ''; return; }
  c.format = loc ? 'in_person' : 'unknown';
  const m = loc.match(/([A-Za-z .'-]+),\s*([A-Z]{2})\b(?:\s*\d{5})?/);
  if (m) {
    let city = m[1].trim(); let before = loc.slice(0, m.index).replace(/[,\s]+$/, '');
    // "1304 South Main Street Plantsville" → city Plantsville, venue = the street address
    const st = city.match(/^(.*\b(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|parkway|pkwy|highway|hwy|place|pl|square|sq)\.?)\s+([A-Za-z .'-]+)$/i);
    if (st) { before = [before, st[1]].filter(Boolean).join(', '); city = st[2].trim(); }
    c.city = city; c.state = m[2];
    const parts = before.split(',').map(x => x.trim()).filter(Boolean);
    const named = parts.find(x => !/^\d/.test(x));
    c.venue = named || parts[0] || '';
  }
  else if (loc) c.venue = loc.split(',')[0].trim();
  c.region = c.state && ['MA', 'CT', 'NY', 'RI', 'NH'].includes(c.state) ? c.state : (source.region || undefined);
  if (c.state === 'NY' && /new york|manhattan|brooklyn/i.test(c.city || '')) c.region = 'NYC';
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
  const todayIso = ymd(new Date(now.getTime() + tzOffsetMinutes('America/New_York', now) * 60000));

  // 1. Which sources run this pass
  let sources = await db.EventSource.list('org_name', 200);
  sources = sources.filter(s => s.is_active !== false && FEED_CHANNELS.has(s.channel) && s.feed_url);
  if (source_id) sources = sources.filter(s => s.id === source_id);
  if (org_code) sources = sources.filter(s => s.org_code === org_code);
  if (!force) sources = sources.filter(s => !s.last_polled_at || (now.getTime() - new Date(s.last_polled_at).getTime()) >= ((s.poll_every_days || 1) * DAY_MS - 3600000));

  // 2. Existing events, indexed once
  const existing = await db.NetworkingEvent.list('-start_date', 2000);
  const byUid = new Map(); const byOrg = new Map();
  for (const e of existing) {
    if (e.source_uid) byUid.set(e.source_uid, e);
    if (!byOrg.has(e.org_code)) byOrg.set(e.org_code, []);
    byOrg.get(e.org_code).push(e);
  }
  const dayOf = (iso) => (iso || '').slice(0, 10);
  const findMatch = (org, c) => {
    if (c.source_uid && byUid.has(c.source_uid)) return byUid.get(c.source_uid);
    const d = new Date(dayOf(c.start_date) + 'T00:00:00Z').getTime();
    for (const e of byOrg.get(org) || []) {
      const ed = new Date(dayOf(e.start_date) + 'T00:00:00Z').getTime();
      if (Math.abs(ed - d) > DAY_MS) continue;
      if (titleSimilarity(e.title, c.title) >= 0.5 || fingerprintOf(org, e.title, dayOf(e.start_date)) === fingerprintOf(org, c.title, dayOf(c.start_date))) return e;
    }
    // Cross-org: MA SHRM's feed re-lists NEHRA and chapter events. Same day + near-identical
    // title anywhere on the calendar counts as the same event (we keep the original org).
    for (const e of existing) {
      if (e.org_code === org || dayOf(e.start_date) !== dayOf(c.start_date)) continue;
      if (titleSimilarity(e.title, c.title) >= 0.75 || slug(e.title) === slug(c.title)) return { ...e, _crossOrg: true };
    }
    return null;
  };

  const report = { ran_at: now.toISOString(), sources: [], created: 0, updated: 0, skipped: 0, archived: 0, dry_run };

  // 3. Per source
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
    let touched = 0;
    for (const c of candidates) {
      // Skip past events (end or start before yesterday) and undated low-confidence noise
      const endDay = dayOf(c.end_date || c.start_date);
      if (!c.start_date || (endDay && endDay < todayIso)) { r.skipped++; continue; }
      applyLocation(c, src);
      const match = findMatch(src.org_code, c);
      if (match?.status === 'rejected') { r.skipped++; continue; }
      const fields = {
        title: c.title, description: c.description, start_date: c.start_date, end_date: c.end_date, all_day: !!c.all_day,
        format: c.format, venue: c.venue, city: c.city, state: c.state, region: c.region,
        registration_url: c.registration_url, source_uid: c.source_uid, raw_ref: c.raw_ref,
        fingerprint: fingerprintOf(src.org_code, c.title, dayOf(c.start_date)), confidence: c.confidence, date_evidence: c.quote,
        channel: src.channel, org_code: src.org_code, org_name: src.org_name, source_id: src.id,
      };
      for (const k of Object.keys(fields)) if (fields[k] === undefined || fields[k] === '') delete fields[k];
      if (match?._crossOrg) {
        // Another org already owns this event; only fill blanks, never re-home it.
        const patch = {};
        for (const k of ['description', 'venue', 'city', 'state', 'registration_url', 'end_date']) if (fields[k] !== undefined && !match[k]) patch[k] = fields[k];
        if (Object.keys(patch).length) { if (!dry_run) await db.NetworkingEvent.update(match.id, patch); r.updated++; report.updated++; }
        else r.skipped++;
        continue;
      }
      if (match) {
        // Update only what the feed knows better; never touch status/intent/owner/notes/opportunity.
        const patch = {};
        for (const k of ['title', 'start_date', 'end_date', 'all_day', 'registration_url', 'source_uid', 'raw_ref', 'fingerprint', 'channel', 'source_id', 'date_evidence', 'confidence']) if (fields[k] !== undefined && fields[k] !== match[k]) patch[k] = fields[k];
        for (const k of ['description', 'venue', 'city', 'state', 'region', 'format']) if (fields[k] !== undefined && (!match[k] || match[k] === 'unknown')) patch[k] = fields[k];
        // Upgrade an all-day row to exact times — unless it's a multi-day conference, where the
        // feed's "start time + 2h" default would erase the real end day.
        const multiDay = match.end_date && dayOf(match.end_date) > dayOf(match.start_date);
        if (match.all_day && !fields.all_day && !multiDay) { patch.start_date = fields.start_date; patch.end_date = fields.end_date; patch.all_day = false; }
        if (multiDay) { delete patch.start_date; delete patch.end_date; delete patch.all_day; }
        if (Object.keys(patch).length) { if (!dry_run) await db.NetworkingEvent.update(match.id, patch); Object.assign(match, patch); r.updated++; report.updated++; touched++; }
        else r.skipped++;
      } else {
        const status = (src.auto_approve && c.confidence === 'high') ? 'approved' : 'pending_review';
        const rec = { ...fields, status, intent: 'none', opportunity: 'none', timezone: 'America/New_York', is_demo: false };
        if (!dry_run) { const created = await db.NetworkingEvent.create(rec); if (created?.source_uid) byUid.set(created.source_uid, created); if (!byOrg.has(src.org_code)) byOrg.set(src.org_code, []); byOrg.get(src.org_code).push(created || rec); }
        r.created++; report.created++; touched++;
      }
    }
    report.sources.push(r);
    if (!dry_run) await db.EventSource.update(src.id, { last_polled_at: now.toISOString(), last_error: '', ...(touched ? { last_success_at: now.toISOString() } : {}) });
  }

  // 4. Archive approved events that have passed (full-run only)
  if (!source_id && !org_code) {
    for (const e of existing) {
      if (e.status !== 'approved') continue;
      const endDay = dayOf(e.end_date || e.start_date);
      if (endDay && endDay < todayIso) { if (!dry_run) await db.NetworkingEvent.update(e.id, { status: 'archived' }); report.archived++; }
    }
  }
  return Response.json(report);
});
