import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

/**
 * Private survey links for the challenges app (challenges.skillfulmeans.life).
 *
 * The challenges app calls this server-to-server when a participant reaches a
 * wellbeing-survey step. It returns that person's day-0, day-14 and 30-day
 * follow-up invite tokens, creating them the first time. The survey link then becomes
 * /CohortAssessment?t=<token>: the page fills in and locks the email from the
 * invite, so every score is filed under the address the person signed in with
 * — no typos, no personal-vs-work mismatch, no duplicate submissions.
 *
 *   POST /functions/issueChallengeSurveyInvites
 *   headers: x-sm-timestamp: <ms since epoch>
 *            x-sm-signature: hex HMAC-SHA256 of `${timestamp}.${rawBody}`
 *                            keyed with the SKMS_SURVEY_INVITE_SECRET secret
 *   body:    { email, program_id, service_id, client_id? }
 *   returns: { day0:     { token, submitted },
 *              day14:    { token, submitted },
 *              followUp: { token, submitted } }   // survey_type cohort_1mo
 *
 * The signature covers the body, so a captured request can't be replayed with
 * a different email, and it expires after five minutes. No secret configured
 * means the function refuses everything.
 */

const WINDOW_MS = 5 * 60 * 1000;
const TIMINGS = { day0: 'challenge_day0', day14: 'challenge_day14', followUp: 'cohort_1mo' } as const;

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

const deny = () => Response.json({ error: 'Not authorised.' }, { status: 401 });

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

  let body: { email?: unknown; program_id?: unknown; service_id?: unknown; client_id?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const email = String(body.email ?? '').toLowerCase().trim();
  const programId = String(body.program_id ?? '').trim();
  const serviceId = String(body.service_id ?? '').trim();
  const clientId = String(body.client_id ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (!programId || !serviceId || programId.length > 100 || serviceId.length > 100 || clientId.length > 100) {
    return Response.json({ error: 'program_id and service_id are required.' }, { status: 400 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    // Same instrument set the un-tokenised CohortAssessment page would show for
    // this service. Without it a token-mode page falls back to eNPS only.
    const services = await db.Service.filter({ id: serviceId });
    const service = services[0];
    if (!service) return Response.json({ error: 'Unknown service_id.' }, { status: 404 });
    const instruments = service.included_assessments?.length ? service.included_assessments : ['who5'];

    const out: Record<string, { token: string; submitted: boolean }> = {};
    for (const [key, surveyType] of Object.entries(TIMINGS)) {
      const existing = await db.SurveyInvite.filter({
        challenge_program_id: programId,
        email,
        survey_type: surveyType,
      });
      const invite = existing[0];
      if (invite) {
        out[key] = { token: invite.token, submitted: !!invite.submitted_at };
        continue;
      }
      const token = crypto.randomUUID();
      await db.SurveyInvite.create({
        token,
        email,
        client_id: clientId || undefined,
        service_id: serviceId,
        challenge_program_id: programId,
        survey_type: surveyType,
        instruments,
        created_at: new Date().toISOString(),
      });
      out[key] = { token, submitted: false };
    }

    return Response.json(out);
  } catch (error) {
    console.error('[issueChallengeSurveyInvites]', error);
    return Response.json({ error: 'Could not issue invites.' }, { status: 500 });
  }
});
