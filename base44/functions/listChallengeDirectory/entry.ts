import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

/**
 * Pick-lists for the challenges app (challenges.skillfulmeans.life) admin.
 *
 * The challenges app links each company to a Base44 Client and each challenge
 * to a Base44 Service by id. Rather than make an admin hunt for 24-character
 * ids, its settings screens show dropdowns built from this list.
 *
 *   POST /functions/listChallengeDirectory
 *   headers: x-sm-timestamp, x-sm-signature — same scheme and secret
 *            (SKMS_SURVEY_INVITE_SECRET) as issueChallengeSurveyInvites:
 *            hex HMAC-SHA256 of `${timestamp}.${rawBody}`
 *   body:    {}
 *   returns: { clients:  [{ id, company, contact, stage, internal }],
 *              services: [{ id, name, active }] }   // category "challenge"
 *
 * Names and ids only — no contact emails, phones, money or notes leave Base44.
 * Demo records are left out.
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only.' }, { status: 405 });

  const secret = (Deno.env.get('SKMS_SURVEY_INVITE_SECRET') || '').trim();
  if (secret.length < 16) return Response.json({ error: 'Not configured.' }, { status: 503 });

  const raw = await req.text();
  const ts = req.headers.get('x-sm-timestamp') || '';
  const sig = (req.headers.get('x-sm-signature') || '').toLowerCase();
  const age = Math.abs(Date.now() - Number(ts));
  if (!ts || !sig || !Number.isFinite(age) || age > WINDOW_MS) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }
  if (!safeEqual(sig, await hmacHex(secret, `${ts}.${raw}`))) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const [clientRows, serviceRows] = await Promise.all([
      db.Client.filter({}, 'company', 5000),
      db.Service.filter({ category: 'challenge' }, 'name', 500),
    ]);

    const clients = clientRows
      .filter((c: { is_demo?: boolean }) => !c.is_demo)
      .map((c: { id: string; company?: string; name?: string; client_stage?: string; is_internal?: boolean }) => ({
        id: c.id,
        company: (c.company || '').trim() || (c.name || '').trim() || '(unnamed client)',
        contact: (c.name || '').trim() || null,
        stage: c.client_stage || null,
        internal: !!c.is_internal,
      }))
      .sort((a: { company: string }, b: { company: string }) => a.company.localeCompare(b.company));

    const services = serviceRows
      .map((s: { id: string; name?: string; is_active?: boolean }) => ({
        id: s.id,
        name: (s.name || '').trim() || '(unnamed service)',
        active: s.is_active !== false,
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    return Response.json({ clients, services });
  } catch (error) {
    console.error('[listChallengeDirectory]', error);
    return Response.json({ error: 'Could not load the directory.' }, { status: 500 });
  }
});
