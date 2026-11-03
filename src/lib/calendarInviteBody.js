export const APP_BASE_URL = 'https://app.skillfulmeans.life';

export function buildCheckinUrl(event) {
  if (!event?.checkin_token) return null;
  return `${APP_BASE_URL}/Checkin?t=${event.checkin_token}`;
}

// ── Challenges ── browser mirror of base44/shared/challengeInvite.ts; keep the two in step.
// A challenge is not a session: its invite carries the challenge's sign-up link
// (CalendarEvent.challenge_signup_url), covers every day of the challenge, and never
// asks for a check-in or a video link.
export const DEFAULT_CHALLENGE_DAYS = 14;

export function isChallengeBooking(event, service) {
  return event?.event_type === 'challenge' || event?.service_category === 'challenge' || service?.category === 'challenge';
}

export function challengeSignupUrl(event) {
  const url = String(event?.challenge_signup_url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(url) ? url : null;
}

export function challengeLengthDays(service) {
  const m = String(service?.duration ?? '').match(/(\d+)\s*-?\s*day/i);
  const n = m ? Number(m[1]) : DEFAULT_CHALLENGE_DAYS;
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : DEFAULT_CHALLENGE_DAYS;
}

/** The Eastern calendar day (YYYY-MM-DD) a stored date falls on; naive times are Eastern already. */
export function easternDay(value) {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  if (!/(z|[+-]\d{2}:?\d{2})$/i.test(s)) return m[1];
  const t = Date.parse(s);
  if (Number.isNaN(t)) return m[1];
  const p = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(t))) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(ymd, days) {
  const [y, mo, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

/** { start, last, endExclusive, days }. endExclusive is the day after the last day (all-day calendar convention). */
export function challengeDateRange(event, service) {
  const start = easternDay(event?.start_date);
  if (!start) return null;
  const end = easternDay(event?.end_date);
  const last = end && end > start ? end : addDays(start, challengeLengthDays(service) - 1);
  const days = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  return { start, last, endExclusive: addDays(last, 1), days };
}

export function longDay(ymd) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${ymd}T12:00:00Z`));
}

export function buildChallengeInviteDescription(event, service) {
  const url = challengeSignupUrl(event);
  const range = challengeDateRange(event, service);
  const parts = [];
  if (url) {
    parts.push(
      'JOIN THE CHALLENGE HERE:',
      url,
      '',
      'How to join (about 2 minutes):',
      '1. Open the link and enter your name and work email.',
      '2. Tap the sign-in link we email you. No password needed.',
      '3. Answer a short starting check-in.',
    );
  } else {
    parts.push('SIGN-UP LINK COMING SOON', 'Your link to join this challenge will be shared before day 1.');
  }
  if (range) {
    parts.push('', `Day 1 is ${longDay(range.start)}. The challenge runs for ${range.days} days, a few minutes a day.`);
  }
  const copy = service?.description || service?.short_description || '';
  if (copy) parts.push('', copy);
  if (Array.isArray(service?.key_benefits) && service.key_benefits.length) {
    parts.push('', 'Key Benefits:');
    for (const b of service.key_benefits) parts.push('• ' + b);
  }
  const own = String(event?.description ?? '').trim();
  if (own && !parts.join('\n').includes(own)) parts.push('', own);
  parts.push('', 'SkillfulMeans Wellness Services');
  return parts.join('\n').trim();
}

export function buildInviteDescription(event, service) {
  if (isChallengeBooking(event, service)) return buildChallengeInviteDescription(event, service);
  const parts = [];
  const checkinUrl = buildCheckinUrl(event);
  if (checkinUrl) {
    parts.push('CHECK IN HERE:');
    parts.push(checkinUrl);
    parts.push('Please check in at this link when the session starts. Your video link will appear right after you check in.');
    parts.push('');
  }
  if (service?.description) parts.push(service.description);
  else if (service?.short_description) parts.push(service.short_description);
  if (service?.key_benefits?.length) {
    parts.push('');
    parts.push('Key Benefits:');
    service.key_benefits.forEach(b => parts.push('• ' + b));
  }
  if (event?.description) {
    const existing = String(event.description).trim();
    // Don't duplicate service copy that's already stored on the event
    if (existing && !parts.join('\n').includes(existing)) {
      parts.push('');
      parts.push(existing);
    }
  }
  parts.push('');
  parts.push('— SkillfulMeans Wellness Services');
  return parts.join('\n').trim();
}

// RFC 5545: escape backslash, semicolon, comma, newline; then fold at 75 octets.
export function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function icsFold(line) {
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) { out.push(' ' + rest.slice(0, 74)); rest = rest.slice(74); }
  if (rest.length) out.push(' ' + rest);
  return out.join('\r\n');
}