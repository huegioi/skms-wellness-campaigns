/**
 * How a challenge booking shows up on Google Calendar and in emailed invites.
 *
 * A challenge is not a session. Nobody checks in to it and there is no video
 * room: people join through the challenges app (challenges.skillfulmeans.life)
 * with the cohort's sign-up link, which is stored on the booking as
 * CalendarEvent.challenge_signup_url. The challenges app also runs every
 * challenge survey (day 0, day 14 and 30 days), so the main app never surveys
 * a challenge at check-in. A challenge's check-in link forwards straight to the
 * sign-up page (getCheckinEvent + src/pages/Checkin.jsx).
 *
 * Used by syncCalendarEventToGoogle, handleCalendarEventChange,
 * sendCalendarInvite and getCheckinEvent. Mirrored for the browser in
 * src/lib/calendarInviteBody.js, so keep the two in step.
 */

type Rec = Record<string, any>;

export const DEFAULT_CHALLENGE_DAYS = 14;
const EASTERN = 'America/New_York';
const DAY_MS = 86_400_000;

export function isChallengeBooking(event?: Rec | null, service?: Rec | null): boolean {
  return event?.event_type === 'challenge' || service?.category === 'challenge';
}

/** The cohort's sign-up link, or null when none has been added yet. */
export function challengeSignupUrl(event?: Rec | null): string | null {
  const url = String(event?.challenge_signup_url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(url) ? url : null;
}

/** "14 Days" → 14. Anything unreadable falls back to the standard two weeks. */
export function challengeLengthDays(service?: Rec | null): number {
  const m = String(service?.duration ?? '').match(/(\d+)\s*-?\s*day/i);
  const n = m ? Number(m[1]) : DEFAULT_CHALLENGE_DAYS;
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : DEFAULT_CHALLENGE_DAYS;
}

/**
 * The Eastern calendar day (YYYY-MM-DD) a stored date falls on. Times stored
 * without an offset are already Eastern wall-clock time, which is how the
 * team books them.
 */
export function easternDay(value: unknown): string | null {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  if (!/(z|[+-]\d{2}:?\d{2})$/i.test(s)) return m[1];
  const t = Date.parse(s);
  if (Number.isNaN(t)) return m[1];
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(t))) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(ymd: string, days: number): string {
  const [y, mo, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

export type ChallengeRange = { start: string; last: string; endExclusive: string; days: number };

/**
 * The days a challenge runs. The last day is the booking's end date when that
 * falls after the start, otherwise start + the service's length. Google's
 * all-day end date is exclusive, hence endExclusive (the day after the last).
 */
export function challengeDateRange(event: Rec, service?: Rec | null): ChallengeRange | null {
  const start = easternDay(event?.start_date);
  if (!start) return null;
  const end = easternDay(event?.end_date);
  const last = end && end > start ? end : addDays(start, challengeLengthDays(service) - 1);
  const days = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
  return { start, last, endExclusive: addDays(last, 1), days };
}

/** "Monday, November 9" */
export function longDay(ymd: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${ymd}T12:00:00Z`));
}

/** "Monday, November 9 to Sunday, November 22 (14 days)" */
export function challengeWhenLine(range: ChallengeRange): string {
  return `${longDay(range.start)} to ${longDay(range.last)} (${range.days} days)`;
}

/** The calendar-invite text for a challenge: how to join first, then what it is. */
export function buildChallengeInviteDescription(event: Rec, service?: Rec | null): string {
  const url = challengeSignupUrl(event);
  const range = challengeDateRange(event, service);
  const parts: string[] = [];
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

/**
 * The Google Calendar fields for a challenge booking: the sign-up link as the
 * location, all-day across every day of the challenge, and marked Free so it
 * never blocks anyone's calendar. Pass forPatch for a PATCH, so a booking that
 * was once a timed event drops its old times (Google merges nested objects).
 */
export function challengeGoogleFields(event: Rec, service?: Rec | null, forPatch = false): Rec {
  const range = challengeDateRange(event, service);
  const clear = forPatch ? { dateTime: null, timeZone: null } : {};
  const fields: Rec = {
    summary: event.title,
    description: buildChallengeInviteDescription(event, service),
    location: challengeSignupUrl(event) || '',
    transparency: 'transparent',
  };
  if (range) {
    fields.start = { date: range.start, ...clear };
    fields.end = { date: range.endExclusive, ...clear };
  }
  return fields;
}
