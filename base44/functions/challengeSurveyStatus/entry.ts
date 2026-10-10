import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

/**
 * Who in a challenge still has baseline questionnaires to answer.
 *
 * The challenges app (challenges.skillfulmeans.life) keeps asking for the
 * day-0 check-in until it's complete. It knows when someone submitted, but not
 * whether the service gained questionnaires since — so it asks here.
 *
 *   POST /functions/challengeSurveyStatus
 *   headers: x-sm-timestamp, x-sm-signature — same scheme and secret
 *            (SKMS_SURVEY_INVITE_SECRET) as issueChallengeSurveyInvites
 *   body:    { program_id }
 *   returns: { day0: { [email]: { remaining: number, total: number } } }
 *
 * Counts only — no answers or scores leave Base44. Uses the same rules as
 * resolveSurveyToken: the service's current list (eNPS dropped for day 0), and
 * only answers given since the person's invite was issued.
 */

const WINDOW_MS = 5 * 60 * 1000;

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

  let body: { program_id?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const programId = String(body.program_id ?? '').trim();
  if (!programId || programId.length > 100) {
    return Response.json({ error: 'program_id is required.' }, { status: 400 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const invites = await db.SurveyInvite.filter({ challenge_program_id: programId, survey_type: 'challenge_day0' });
    const day0: Record<string, { remaining: number; total: number }> = {};
    if (!invites.length) return Response.json({ day0 });

    // Services, and every day-0 answer from these people under them.
    const serviceIds = [...new Set(invites.map((i: { service_id?: string }) => i.service_id).filter(Boolean))];
    const services = await Promise.all(serviceIds.map((id) => db.Service.filter({ id })));
    const listFor = new Map<string, string[]>();
    serviceIds.forEach((id, n) => {
      const all: string[] = services[n]?.[0]?.included_assessments?.length ? services[n][0].included_assessments : ['who5'];
      const baseline = all.filter((k) => k !== 'enps');
      listFor.set(id as string, baseline.length ? baseline : ['who5']);
    });

    const answers = (
      await Promise.all(
        serviceIds.map((id) => db.CohortAssessment.filter({ service_id: id, survey_type: 'challenge_day0' }, '-created_date', 5000))
      )
    ).flat();

    for (const inv of invites) {
      const email = String(inv.email || '').toLowerCase().trim();
      if (!email) continue;
      const list = listFor.get(inv.service_id) || ['who5'];
      const since = inv.created_at ? new Date(inv.created_at).getTime() - 60_000 : 0;
      const done = new Set<string>();
      for (const a of answers) {
        if (String(a.participant_email || '').toLowerCase().trim() !== email || a.service_id !== inv.service_id) continue;
        const at = new Date(a.submitted_at || a.created_date || 0).getTime();
        if (a.instrument && at >= since) done.add(a.instrument);
      }
      const remaining = list.filter((k) => !done.has(k)).length;
      // An admin who corrected the service id leaves an older invite behind;
      // the most complete picture for the person wins.
      const prev = day0[email];
      if (!prev || remaining < prev.remaining) day0[email] = { remaining, total: list.length };
    }

    return Response.json({ day0 });
  } catch (error) {
    console.error('[challengeSurveyStatus]', error);
    return Response.json({ error: 'Could not read survey status.' }, { status: 500 });
  }
});
