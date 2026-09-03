// Shared helpers for the Networking Events calendar: date/zone handling, ICS parsing,
// location parsing, and the dedupe/upsert routine used by every ingestion channel
// (feeds, inbox, page scrapers). Functions import this with
//   import { ... } from '../../shared/networkingEvents.ts';
// Keep it dependency-free (Deno std only).

export const TEAM_EMAILS = (Deno.env.get('TEAM_EMAILS') || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
export const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || '').toLowerCase()));
export const UA = 'Mozilla/5.0 (compatible; SkillfulMeans events sync; +https://skillfulmeans.life)';
export const FEED_CHANNELS = new Set(['feed_rss', 'feed_json', 'feed_ics']);
export const DAY_MS = 86400000;

// ---- small utilities --------------------------------------------------------
export const decodeEntities = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&#8217;/g, '’').replace(/&#8220;/g, '“').replace(/&#8221;/g, '”').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
  .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&');
export const stripHtml = (s = '') => decodeEntities(s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
export const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]).trim() : '';
};
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Offset (minutes) of an IANA zone at a given UTC instant, via Intl.
export function tzOffsetMinutes(tz, atUtc) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(atUtc).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - atUtc.getTime()) / 60000);
}
// "2026-10-13" + "17:30" in America/New_York → ISO instant with the right offset.
export function zonedToIso(dateStr, timeStr, tz = 'America/New_York') {
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
export function parseClock(s) {
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
export function findTextDates(text) {
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
const slugNoYear = (s) => slug(s).replace(/-?\d{4}(?=-|$)/g, '');
export function titleSimilarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return slugNoYear(a) === slugNoYear(b) ? 1 : 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
export const todayMinus = (days) => { const d = new Date(Date.now() - days * DAY_MS); return ymd(d); };
export const slug = (s = '') => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export const fingerprintOf = (org, title, dayIso) => `${org}|${slug(title)}|${dayIso}`;

// ---- fetch helpers ----------------------------------------------------------
export async function fetchText(url, accept = 'application/rss+xml, application/xml, text/xml, text/calendar, application/json, text/html;q=0.8, */*;q=0.5') {
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
// SUMMARY, LOCATION, URL, UID, DESCRIPTION, STATUS. Enough for per-event ICS files
// and calendar invites.
export function parseIcs(text) {
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
      location: e.LOCATION?.value?.trim(), url: e.URL?.value?.trim(), status: e.STATUS?.value?.trim(),
      start: s?.iso, end: endIso, allDay: !!s?.allDay,
    };
  }).filter(e => e.title && e.start);
}

// ---- location → venue/city/state/format ------------------------------------
export function applyLocation(c, source) {
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

export const todayIsoNY = () => { const now = new Date(); return ymd(new Date(now.getTime() + tzOffsetMinutes('America/New_York', now) * 60000)); };
export const dayOf = (iso) => (iso || '').slice(0, 10);

// ---- event index + upsert -----------------------------------------------------
// Loads every NetworkingEvent once and answers "is this candidate already on the
// calendar?" — by exact source_uid, then same org ±1 day with a similar title, then
// same day anywhere with a near-identical title (MA SHRM re-lists NEHRA events).
export async function loadEventIndex(db) {
  const existing = await db.NetworkingEvent.list('-start_date', 2000);
  const byUid = new Map(); const byOrg = new Map();
  const add = (e) => {
    if (e.source_uid) byUid.set(e.source_uid, e);
    if (!byOrg.has(e.org_code)) byOrg.set(e.org_code, []);
    byOrg.get(e.org_code).push(e);
  };
  for (const e of existing) add(e);
  const findMatch = (org, c) => {
    if (c.source_uid && byUid.has(c.source_uid)) return byUid.get(c.source_uid);
    const d = new Date(dayOf(c.start_date) + 'T00:00:00Z').getTime();
    for (const e of byOrg.get(org) || []) {
      const ed = new Date(dayOf(e.start_date) + 'T00:00:00Z').getTime();
      if (Math.abs(ed - d) > DAY_MS) continue;
      if (titleSimilarity(e.title, c.title) >= 0.5 || fingerprintOf(org, e.title, dayOf(e.start_date)) === fingerprintOf(org, c.title, dayOf(c.start_date))) return e;
    }
    for (const e of existing) {
      if (e.org_code === org || dayOf(e.start_date) !== dayOf(c.start_date)) continue;
      if (titleSimilarity(e.title, c.title) >= 0.75 || slug(e.title) === slug(c.title)) return { ...e, _crossOrg: true };
    }
    return null;
  };
  return { existing, byUid, byOrg, add, findMatch };
}

// Candidate shape: { title, description?, start_date, end_date?, all_day, location?, venue?, city?, state?,
//   region?, format?, registration_url?, cost_text?, source_uid?, raw_ref?, confidence, quote }
// Returns 'created' | 'updated' | 'skipped'. Never touches status/intent/owner/notes/opportunity
// on an existing row; rejected rows are tombstones; multi-day rows keep their end date;
// a less exact channel (email/scrape) never overwrites dates set by a more exact one (invite/feed).
export async function upsertCandidate(db, src, c, index, { dry_run = false, channel, todayIso } = {}) {
  const today = todayIso || todayIsoNY();
  const endDay = dayOf(c.end_date || c.start_date);
  if (!c.start_date || (endDay && endDay < today)) return 'skipped';
  if (!c.format) applyLocation(c, src);
  const match = index.findMatch(src.org_code, c);
  if (match?.status === 'rejected') return 'skipped';
  const fields = {
    title: c.title, description: c.description, start_date: c.start_date, end_date: c.end_date, all_day: !!c.all_day,
    format: c.format, venue: c.venue, city: c.city, state: c.state, region: c.region,
    registration_url: c.registration_url, cost_text: c.cost_text, source_uid: c.source_uid, raw_ref: c.raw_ref,
    fingerprint: fingerprintOf(src.org_code, c.title, dayOf(c.start_date)), confidence: c.confidence || 'medium', date_evidence: c.quote,
    channel: channel || src.channel, org_code: src.org_code, org_name: src.org_name, source_id: src.id,
  };
  for (const k of Object.keys(fields)) if (fields[k] === undefined || fields[k] === '' || fields[k] === null) delete fields[k];
  if (match?._crossOrg) {
    const patch = {};
    for (const k of ['description', 'venue', 'city', 'state', 'registration_url', 'cost_text', 'end_date']) if (fields[k] !== undefined && !match[k]) patch[k] = fields[k];
    if (!Object.keys(patch).length) return 'skipped';
    if (!dry_run) await db.NetworkingEvent.update(match.id, patch);
    return 'updated';
  }
  if (match) {
    const patch = {};
    const exactness = { invite: 3, feed_ics: 3, feed_rss: 2, feed_json: 2, scrape: 1, email: 1, manual: 0 };
    const incoming = exactness[fields.channel] ?? 1, current = exactness[match.channel] ?? 0;
    const canOverwrite = incoming >= current;
    if (canOverwrite) for (const k of ['title', 'start_date', 'end_date', 'all_day', 'registration_url', 'source_uid', 'raw_ref', 'fingerprint', 'channel', 'source_id', 'date_evidence', 'confidence']) if (fields[k] !== undefined && fields[k] !== match[k]) patch[k] = fields[k];
    for (const k of ['description', 'venue', 'city', 'state', 'region', 'format', 'cost_text', 'registration_url']) if (fields[k] !== undefined && (!match[k] || match[k] === 'unknown')) patch[k] = fields[k];
    const multiDay = match.end_date && dayOf(match.end_date) > dayOf(match.start_date);
    if (canOverwrite && match.all_day && !fields.all_day && !multiDay) { patch.start_date = fields.start_date; patch.end_date = fields.end_date; patch.all_day = false; }
    if (multiDay) { delete patch.start_date; delete patch.end_date; delete patch.all_day; }
    if (!Object.keys(patch).length) return 'skipped';
    if (!dry_run) await db.NetworkingEvent.update(match.id, patch);
    Object.assign(match, patch);
    return 'updated';
  }
  const status = (src.auto_approve && (fields.confidence === 'high')) ? 'approved' : 'pending_review';
  const rec = { ...fields, status, intent: 'none', opportunity: 'none', timezone: 'America/New_York', is_demo: false };
  if (!dry_run) { const created = await db.NetworkingEvent.create(rec); index.add(created || rec); }
  else index.add(rec);
  return 'created';
}

// Archive approved events whose last day has passed. Returns how many were archived.
export async function archivePastEvents(db, index, { dry_run = false, todayIso } = {}) {
  const today = todayIso || todayIsoNY();
  let n = 0;
  for (const e of index.existing) {
    if (e.status !== 'approved') continue;
    const endDay = dayOf(e.end_date || e.start_date);
    if (endDay && endDay < today) { if (!dry_run) await db.NetworkingEvent.update(e.id, { status: 'archived' }); n++; }
  }
  return n;
}
