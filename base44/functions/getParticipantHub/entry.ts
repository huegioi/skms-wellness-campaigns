import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

/**
 * Participant hub data, for the SkillfulMeans participant app (the Challenges
 * app on Railway, challenges.skillfulmeans.life).
 *
 * Server-to-server only. The participant app signs every request with the
 * SKMS_SURVEY_INVITE_SECRET it already shares with this app for survey invites
 * (same scheme as issueChallengeSurveyInvites):
 *   headers: x-sm-timestamp: <ms since epoch>
 *            x-sm-signature: hex HMAC-SHA256 of `${timestamp}.${rawBody}`
 * The signature covers the body, so a captured request can't be replayed for
 * another person, and anything signed more than five minutes ago is refused.
 * No secret configured means the function refuses everything.
 *
 *   POST /functions/getParticipantHub
 *   { action: 'hub', email, client_id }
 *     → { company, sessions, services, my_checkins, my_surveys, generated_at }
 *   { action: 'checkin', email, client_id, event_id, name?, dry_run? }
 *     → { ok, recorded, reason?, meeting_link }
 *
 * Privacy: every answer is about ONE company and ONE person. No other
 * person's name, email, check-in or score leaves this function.
 *
 * Materials follow the HR portal's release rule (shared/resourceAvailability.ts,
 * inlined here so this function deploys on its own): workshop, class and
 * leadership resources unlock when the company's session for that service has
 * ended; challenge resources when the challenge starts; wellness boxes always.
 * A locked resource goes out as a stub with no file link.
 *
 * Times: Base44 stores some session times without an offset. Those are read as
 * America/New_York wall-clock time (how the team books them), and every time
 * this function returns is a UTC ISO string.
 */

const WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HEX_ID = /^[a-f0-9]{24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Event types a participant would call a session. Meetings and sales follow-ups never are. */
const SESSION_TYPES = new Set(['workshop', 'challenge', 'leadership', 'class', 'delivery', 'presentation']);
const HISTORY_DAYS = 400;
const SURVEY_DAYS = 90;
const DEFAULT_LENGTH_MS = 60 * 60 * 1000;
const CHALLENGE_LENGTH_MS = 14 * DAY_MS;
/** Attendance is recorded from 2 hours before a session starts until 2 hours after it ends. */
const CHECKIN_EARLY_MS = 2 * 60 * 60 * 1000;
const CHECKIN_LATE_MS = 2 * 60 * 60 * 1000;
/** A second tap on Join inside this window is the same attendance, not a new one. */
const CHECKIN_DEDUPE_MS = 12 * 60 * 60 * 1000;

/* ---------------------------------------------------------------- signing */

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const deny = () => Response.json({ error: 'Not authorized.' }, { status: 401 });

/* ------------------------------------------------------------------ times */

const EASTERN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Minutes America/New_York is ahead of UTC at this instant (negative: -240 or -300). */
function easternOffsetMinutes(utcMs: number): number {
  const p: Record<string, string> = {};
  for (const part of EASTERN.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - utcMs) / 60000);
}

/** Milliseconds since epoch for a Base44 date string, or null. Naive times are Eastern. */
function toMs(value: unknown): number | null {
  if (!value) return null;
  let s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
  if (/(z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  const wall = Date.parse(`${s}Z`);
  if (Number.isNaN(wall)) return null;
  let t = wall - easternOffsetMinutes(wall) * 60000;
  t = wall - easternOffsetMinutes(t) * 60000; // second pass settles DST edges
  return t;
}

const toIso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

/* -------------------------------------------------------------- the rules */

type Ev = Record<string, any>;

function isUrl(s: unknown): boolean {
  return /^https?:\/\//i.test(String(s || '').trim());
}

function meetingLinkOf(e: Ev): string | null {
  if (e.meeting_link && isUrl(e.meeting_link)) return String(e.meeting_link).trim();
  if (isUrl(e.location)) return String(e.location).trim();
  return null;
}

function bounds(e: Ev): { start: number | null; end: number | null } {
  const start = toMs(e.start_date);
  let end = toMs(e.end_date);
  if (end == null && start != null) {
    end = start + (e.event_type === 'challenge' ? CHALLENGE_LENGTH_MS : DEFAULT_LENGTH_MS);
  }
  return { start, end };
}

/** Same release rule the HR portal uses — see the header comment. */
function availability(service: Ev, events: Ev[], now: number): { available: boolean; availableAfter: string | null } {
  if (service.category === 'wellness_box') return { available: true, availableAfter: null };
  let next: number | null = null;
  for (const e of events) {
    if (e.event_type === 'meeting' || !e.service_id || e.service_id !== service.id) continue;
    const t = e.event_type === 'challenge' ? toMs(e.start_date) : (toMs(e.end_date) ?? toMs(e.start_date));
    if (t == null) continue;
    if (t <= now) return { available: true, availableAfter: null };
    if (next == null || t < next) next = t;
  }
  return { available: false, availableAfter: toIso(next) };
}

function selectedServiceIds(proposal: Ev): string[] {
  const sel = proposal.selections || {};
  const out: string[] = [];
  for (const ids of [sel.workshops, sel.challengePrograms, sel.leadership, sel.movementClasses, sel.wellnessBoxes]) {
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') out.push(id);
  }
  return out;
}

/* ---------------------------------------------------------------- handler */

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only.' }, { status: 405 });

  const secret = (Deno.env.get('SKMS_SURVEY_INVITE_SECRET') || '').trim();
  if (secret.length < 16) return Response.json({ error: 'Not configured.' }, { status: 503 });

  const raw = await req.text();
  const ts = req.headers.get('x-sm-timestamp') || '';
  const sig = (req.headers.get('x-sm-signature') || '').toLowerCase();
  const age = Math.abs(Date.now() - Number(ts));
  if (!ts || !sig || !Number.isFinite(age) || age > WINDOW_MS) return deny();
  if (!safeEqual(sig, await hmacHex(secret, `${ts}.${raw}`))) return deny();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const action = String(body.action ?? 'hub');
  const email = String(body.email ?? '').toLowerCase().trim();
  const clientId = String(body.client_id ?? '').trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (!HEX_ID.test(clientId)) return Response.json({ error: 'A valid client_id is required.' }, { status: 400 });

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const client = (await db.Client.filter({ id: clientId }))[0];
    if (!client) return Response.json({ error: 'Unknown client.' }, { status: 404 });
    // A seeded demo client sees its demo rows; a real client never does.
    const excludeDemo = client.is_demo !== true;
    const demoFrag = excludeDemo ? { is_demo: { $ne: true } } : {};
    const now = Date.now();

    /* ---------------------------------------------------------- check-in */
    if (action === 'checkin') {
      const eventId = String(body.event_id ?? '').trim();
      if (!HEX_ID.test(eventId)) return Response.json({ error: 'A valid event_id is required.' }, { status: 400 });
      const ev = (await db.CalendarEvent.filter({ id: eventId }))[0];
      if (!ev || (excludeDemo && ev.is_demo) || !SESSION_TYPES.has(ev.event_type || '')) {
        return Response.json({ error: 'No such session.' }, { status: 404 });
      }
      let belongs = ev.client_id === client.id;
      if (!belongs && ev.proposal_id) {
        const own = await db.Proposal.filter({ id: ev.proposal_id, client_id: client.id });
        belongs = own.length > 0;
      }
      if (!belongs) return Response.json({ error: 'No such session.' }, { status: 404 });

      const { start, end } = bounds(ev);
      const link = meetingLinkOf(ev);
      const stillUseful = end != null && now <= end + CHECKIN_LATE_MS;
      if (start == null || end == null || now < start - CHECKIN_EARLY_MS || now > end + CHECKIN_LATE_MS) {
        return Response.json({ ok: true, recorded: false, reason: 'outside_window', meeting_link: stillUseful ? link : null });
      }
      const recent = await db.EventCheckin.filter({ event_id: ev.id, email }, '-checked_in_at', 5);
      const already = recent.some((c: Ev) => now - (toMs(c.checked_in_at) ?? 0) < CHECKIN_DEDUPE_MS);
      if (already || body.dry_run === true) {
        return Response.json({ ok: true, recorded: false, reason: already ? 'already' : 'dry_run', meeting_link: link });
      }
      await db.EventCheckin.create({
        event_id: ev.id,
        client_id: ev.client_id || client.id,
        name: String(body.name ?? '').trim().slice(0, 120),
        email,
        checked_in_at: new Date(now).toISOString(),
      });
      return Response.json({ ok: true, recorded: true, meeting_link: link });
    }

    if (action !== 'hub') return Response.json({ error: 'Unknown action.' }, { status: 400 });

    /* --------------------------------------------------------------- hub */
    const [proposals, byClient, services, presenters, checkins, invites] = await Promise.all([
      db.Proposal.filter({ client_id: client.id }, '-created_date', 200),
      db.CalendarEvent.filter({ client_id: client.id, ...demoFrag }, 'start_date', 2000),
      db.Service.list('sort_order', 500),
      db.Presenter.list('name', 200),
      db.EventCheckin.filter({ email, ...demoFrag }, '-checked_in_at', 500),
      db.SurveyInvite.filter({ email }, '-created_at', 300),
    ]);

    // Events filed under one of this client's proposals but without a
    // client_id are theirs too (the HR portal's rule). Exact ids only.
    const ownProposals = proposals.filter((p: Ev) => !(excludeDemo && p.is_demo));
    const proposalIds = ownProposals.map((p: Ev) => p.id).filter(Boolean);
    const byProposal = proposalIds.length
      ? await db.CalendarEvent.filter({ proposal_id: { $in: proposalIds }, ...demoFrag }, 'start_date', 2000)
      : [];
    const eventMap = new Map<string, Ev>();
    for (const e of [...byClient, ...byProposal]) if (e && e.id) eventMap.set(e.id, e);
    const events = [...eventMap.values()].filter((e) => !(excludeDemo && e.is_demo));

    const serviceById = new Map<string, Ev>();
    for (const s of services) serviceById.set(s.id, s);
    const presenterById = new Map<string, Ev>();
    for (const p of presenters) presenterById.set(p.id, p);

    const sessions = events
      .filter((e) => SESSION_TYPES.has(e.event_type || ''))
      .map((e) => {
        const { start, end } = bounds(e);
        return { e, start, end };
      })
      .filter(({ start }) => start != null && start >= now - HISTORY_DAYS * DAY_MS)
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
      .map(({ e, start, end }) => {
        const ended = end != null && end < now;
        const service = e.service_id ? serviceById.get(e.service_id) : null;
        const presenter = e.presenter_id ? presenterById.get(e.presenter_id) : null;
        return {
          id: e.id,
          title: e.title || service?.name || 'Session',
          event_type: e.event_type,
          start: toIso(start),
          end: toIso(end),
          all_day: !!e.all_day,
          service_id: e.service_id || null,
          service_name: service?.name || null,
          presenter_name: presenter?.name || (typeof e.presenter === 'string' && e.presenter.trim()) || null,
          delivery_format: e.delivery_format || null,
          location: e.location && !isUrl(e.location) ? String(e.location).trim() : null,
          // A past session's join link is no use to anyone; leave it behind.
          meeting_link: end != null && now <= end + DAY_MS ? meetingLinkOf(e) : null,
          recording_link: ended && isUrl(e.recording_link) ? String(e.recording_link).trim() : null,
          completed: !!e.completed,
        };
      });

    // What the company bought: accepted or delivered proposals, plus any
    // service it has a session for.
    const purchased = new Set<string>();
    for (const p of ownProposals) {
      if (p.status === 'accepted' || p.status === 'fulfilled') selectedServiceIds(p).forEach((id) => purchased.add(id));
    }
    for (const e of events) if (e.service_id && SESSION_TYPES.has(e.event_type || '')) purchased.add(e.service_id);

    const outServices = [...purchased]
      .map((id) => serviceById.get(id))
      .filter(Boolean)
      .map((s: Ev) => {
        const avail = availability(s, events, now);
        const resources = (Array.isArray(s.resources) ? s.resources : []).filter(
          (r: Ev) => r && r.participant_visible !== false && String(r.file_url || '').trim()
        );
        return {
          id: s.id,
          name: s.name,
          category: s.category || null,
          short_description: s.short_description || null,
          duration: s.duration || null,
          image_url: Array.isArray(s.images) && s.images[0]?.url ? s.images[0].url : null,
          available: avail.available,
          available_after: avail.availableAfter,
          resources: resources.map((r: Ev) =>
            avail.available
              ? {
                  title: r.title || 'Resource',
                  resource_type: r.resource_type || 'other',
                  description: r.description || '',
                  file_url: String(r.file_url).trim(),
                  uploaded_date: r.uploaded_date || null,
                }
              : {
                  title: r.title || 'Resource',
                  resource_type: r.resource_type || 'other',
                  description: r.description || '',
                  locked: true,
                  available_after: avail.availableAfter,
                }
          ),
        };
      });

    const eventIds = new Set(events.map((e) => e.id));
    const myCheckins = checkins
      .filter((c: Ev) => eventIds.has(c.event_id))
      .map((c: Ev) => ({ event_id: c.event_id, checked_in_at: toIso(toMs(c.checked_in_at)) }));

    const mySurveys = invites
      .filter((i: Ev) => {
        const mine = i.client_id ? i.client_id === client.id : !!(i.service_id && purchased.has(i.service_id));
        if (!mine || !i.token) return false;
        const last = toMs(i.submitted_at) ?? toMs(i.created_at) ?? 0;
        return now - last <= SURVEY_DAYS * DAY_MS;
      })
      .map((i: Ev) => ({
        token: i.token,
        survey_type: i.survey_type,
        service_id: i.service_id || null,
        service_name: i.service_id ? serviceById.get(i.service_id)?.name || null : null,
        event_id: i.event_id || null,
        challenge_program_id: i.challenge_program_id || null,
        instruments: Array.isArray(i.instruments) ? i.instruments : [],
        created_at: toIso(toMs(i.created_at)),
        submitted_at: toIso(toMs(i.submitted_at)),
      }));

    const domains = [client.email_domain, ...(Array.isArray(client.email_domain_aliases) ? client.email_domain_aliases : [])]
      .map((d: unknown) => String(d || '').trim().toLowerCase())
      .filter(Boolean);

    return Response.json({
      company: { id: client.id, name: client.company || client.name || '', email_domains: [...new Set(domains)] },
      sessions,
      services: outServices,
      my_checkins: myCheckins,
      my_surveys: mySurveys,
      generated_at: new Date(now).toISOString(),
    });
  } catch (error) {
    console.error('[getParticipantHub]', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Could not build the hub.' }, { status: 500 });
  }
});
