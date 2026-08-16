/**
 * scoreClaimsProfile — the canonical Claims Insight scoring endpoint.
 *
 * The engine itself is pure (shared/claimsScoring.ts); this function is the
 * I/O wrapper: load saved benchmark overrides → score → resolve the Company
 * (Client) by email DOMAIN, never by name → persist a ClaimsProfile snapshot.
 *
 * Admin-only in Phase 2. Phase 3 (the public broker link) will reuse the same
 * shared engine behind a separate, gated public function — do not loosen the
 * auth here for that.
 *
 * Body:
 *   { inputs, company_name, company_domain?, contact_email?, broker_name?,
 *     report_year?, notes?, is_demo?, profile_id? (re-score/update),
 *     preview? (score only, save nothing) }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { loadClaimsBenchmarks } from '../../shared/loadClaimsBenchmarks.ts';
import { currentClaimsBenchmarks } from '../../shared/claimsBenchmarks.ts';
import { scoreClaimsProfile, recommendClaimsCampaign } from '../../shared/claimsScoring.ts';
import { getOrgDomain, isExcludedDomain } from '../../shared/emailDomain.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { inputs, company_name, broker_name, report_year, notes, is_demo, profile_id, preview } = body;

    if (!inputs || typeof inputs !== 'object') {
      return Response.json({ error: 'Missing inputs' }, { status: 400 });
    }
    const headcount = Number(inputs.headcount);
    if (!isFinite(headcount) || headcount <= 0) {
      return Response.json({ error: 'Block A requires a headcount above 0' }, { status: 400 });
    }

    // Aggregate-only guardrail: numbers and picklists came in; refuse
    // anything that smells like member-level data slipped into a string.
    for (const [k, v] of Object.entries(inputs)) {
      if (typeof v === 'string' && v.length > 120) {
        return Response.json({ error: `Field "${k}" looks like pasted report text — enter numbers and Y/N only` }, { status: 400 });
      }
    }

    // Saved benchmark overrides first, so scoring matches the admin tab.
    await loadClaimsBenchmarks(base44);

    const results = scoreClaimsProfile(inputs);
    const campaign = recommendClaimsCampaign(results, inputs);

    // ── Company link — by email domain ONLY (companies-are-the-client) ──
    let company_domain: string | null = null;
    const rawDomain = (body.company_domain || '').toString().toLowerCase().trim()
      || getOrgDomain(body.contact_email);
    if (rawDomain && !isExcludedDomain(rawDomain)) company_domain = rawDomain;

    let client_id: string | null = null;
    if (company_domain) {
      try {
        const clients = await base44.asServiceRole.entities.Client.filter(
          { email_domain: company_domain }, '-created_date', 1,
        );
        if (clients && clients.length > 0) client_id = clients[0].id;
      } catch (err) {
        console.error('[scoreClaimsProfile] client lookup failed:', (err as any)?.message);
      }
    }

    const payload = {
      results: { ...results, campaign },
      company_domain,
      client_id,
    };

    if (preview) return Response.json(payload);

    const record = {
      company_name: String(company_name || 'Unnamed company').slice(0, 200),
      company_domain: company_domain || undefined,
      client_id: client_id || undefined,
      broker_name: broker_name ? String(broker_name).slice(0, 200) : undefined,
      report_year: isFinite(Number(report_year)) ? Number(report_year) : undefined,
      inputs,
      results: { ...results, campaign },
      confidence: results.confidence,
      benchmarks_used: currentClaimsBenchmarks().values,
      is_demo: is_demo === true,
      notes: notes ? String(notes).slice(0, 2000) : undefined,
      scored_at: new Date().toISOString(),
      scored_by: user.email,
    };

    let saved;
    if (profile_id) {
      saved = await base44.entities.ClaimsProfile.update(profile_id, record);
    } else {
      saved = await base44.entities.ClaimsProfile.create(record);
    }

    return Response.json({ ...payload, profile: saved });
  } catch (err) {
    console.error('[scoreClaimsProfile]', (err as any)?.message || err);
    return Response.json({ error: 'Scoring failed' }, { status: 500 });
  }
});
