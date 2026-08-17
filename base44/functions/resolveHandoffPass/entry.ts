/**
 * resolveHandoffPass — turns a ?pass= token back into the facts the next
 * screen should show and prefill.
 *
 * Returns only what the visitor themselves entered a moment ago, plus, when
 * their work email domain matches a Client we already know, a small
 * "we have you on file" block so an EXISTING CLIENT's details carry through
 * the funnel too (William, 2026-08-17).
 *
 * Deliberately withholds anything they didn't provide: no internal notes, no
 * revenue, no pipeline stage — this endpoint is public.
 *
 * Body: { pass }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isExpired, deepestRung, RUNG_LABELS } from '../../shared/handoffPass.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { pass } = await req.json();
    if (!pass) return Response.json({ error: 'pass is required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.HandoffPass.filter({ token: pass }, '-created_date', 1);
    const found = rows?.[0];
    if (!found) return Response.json({ found: false });
    if (isExpired(found)) return Response.json({ found: false, expired: true });

    const payload = found.payload || {};
    const chain: string[] = Array.isArray(found.source_chain) ? found.source_chain : [];
    const deepest = deepestRung(chain);

    // ── What the visitor already gave us, to show back and prefill ──
    const carried = {
      company_name: payload.company_name || null,
      contact_name: payload.contact_name || null,
      headcount: payload.headcount ?? null,
      avg_salary: payload.avg_salary ?? null,
      industry: payload.industry || null,
      email: payload.email || null,
      highlights: Array.isArray(payload.highlights) ? payload.highlights.slice(0, 4) : [],
      from_label: deepest ? (RUNG_LABELS[deepest] || deepest) : null,
      source_chain: chain,
    };

    // ── Existing-client enrichment (domain match only) ──
    let known: Record<string, unknown> | null = null;
    if (found.client_id || payload.domain) {
      try {
        let client: any = null;
        if (found.client_id) {
          client = await base44.asServiceRole.entities.Client.get(found.client_id).catch(() => null);
        }
        if (!client && payload.domain) {
          const byDomain = await base44.asServiceRole.entities.Client.filter(
            { email_domain: payload.domain }, '-created_date', 1,
          );
          client = byDomain?.[0] || null;
        }
        if (client) {
          const isCurrentClient = client.is_assessment_lead !== true;
          // Their most recent claims read, so a returning client sees continuity.
          let lastProfile: any = null;
          try {
            const profiles = await base44.asServiceRole.entities.ClaimsProfile.filter(
              { client_id: client.id }, '-scored_at', 1,
            );
            lastProfile = profiles?.[0] || null;
          } catch { /* optional */ }

          known = {
            is_current_client: isCurrentClient,
            company_name: client.name || client.company || null,
            headcount: client.employee_count ?? null,
            industry: client.industry || null,
            last_claims_year: lastProfile?.report_year ?? null,
            last_claims_confidence: lastProfile?.confidence ?? null,
          };
        }
      } catch (err) {
        console.error('[resolveHandoffPass] client lookup:', (err as any)?.message || err);
      }
    }

    return Response.json({ found: true, carried, known, ref: found.ref || null, is_demo: found.is_demo === true });
  } catch (err) {
    console.error('[resolveHandoffPass]', (err as any)?.message || err);
    return Response.json({ error: 'Could not resolve pass' }, { status: 500 });
  }
});
