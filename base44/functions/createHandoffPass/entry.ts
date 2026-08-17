/**
 * createHandoffPass — mints (or extends) the token that carries context
 * between warming tools.
 *
 * Public: the tools that call it are public pages. It only ever stores what
 * the caller already had on screen, and returns nothing but a token.
 *
 * Body: { source, payload, ref?, journey_id?, claims_profile_id?, is_demo?, pass? }
 * Passing an existing `pass` appends to that journey instead of starting a new one.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { newPassToken, passExpiry, appendRung, mergePayload } from '../../shared/handoffPass.ts';
import { getOrgDomain } from '../../shared/emailDomain.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { source, payload = {}, ref, journey_id, claims_profile_id, is_demo, pass } = body;

    if (!source) return Response.json({ error: 'source is required' }, { status: 400 });

    // Guardrail: this carries figures and a company name, never free text.
    for (const [k, v] of Object.entries(payload || {})) {
      if (typeof v === 'string' && v.length > 200) {
        return Response.json({ error: `payload.${k} is too long` }, { status: 400 });
      }
    }
    const clean = { ...payload };
    if (clean.email) clean.domain = getOrgDomain(clean.email) || clean.domain || null;

    // ── Extend an existing journey when a token was supplied ──
    if (pass) {
      const rows = await base44.asServiceRole.entities.HandoffPass.filter({ token: pass }, '-created_date', 1);
      const found = rows?.[0];
      if (found) {
        await base44.asServiceRole.entities.HandoffPass.update(found.id, {
          source_chain: appendRung(found.source_chain, source),
          payload: mergePayload(found.payload, clean),
          ref: found.ref || ref || undefined,
          journey_id: journey_id || found.journey_id || undefined,
          claims_profile_id: claims_profile_id || found.claims_profile_id || undefined,
          expires_at: passExpiry(),
        });
        return Response.json({ pass: found.token });
      }
      // Unknown/expired token — fall through and start a fresh journey.
    }

    const token = newPassToken();
    await base44.asServiceRole.entities.HandoffPass.create({
      token,
      source_chain: [source],
      payload: clean,
      ref: ref || undefined,
      journey_id: journey_id || undefined,
      claims_profile_id: claims_profile_id || undefined,
      expires_at: passExpiry(),
      is_demo: is_demo === true,
    });

    return Response.json({ pass: token });
  } catch (err) {
    console.error('[createHandoffPass]', (err as any)?.message || err);
    return Response.json({ error: 'Could not create pass' }, { status: 500 });
  }
});
