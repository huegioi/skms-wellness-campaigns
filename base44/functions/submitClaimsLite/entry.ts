/**
 * submitClaimsLite — the public five-field claims quick read.
 *
 * Scores with the SAME shared engine as the internal Claims Insight module
 * (claimsScoring.ts against claimsBenchmarks.ts), so the headline a prospect
 * sees here and the number William quotes on the call can never disagree.
 *
 * Saves a ClaimsProfile in `draft` status, files the contact as a Client Lead
 * via the single warm writer (never touches the legacy Lead table), stamps the
 * timeline, and extends the handoff pass.
 *
 * Returns the headline only — the full five-page read is deliberately held
 * for the conversation.
 *
 * Body: { inputs, company_name, email, contact_name?, report_year?, pass?, ref?, is_demo? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { loadClaimsBenchmarks } from '../../shared/loadClaimsBenchmarks.ts';
import { currentClaimsBenchmarks } from '../../shared/claimsBenchmarks.ts';
import { scoreClaimsProfile, recommendClaimsCampaign } from '../../shared/claimsScoring.ts';
import { upsertClientLead, logWarmInteraction } from '../../shared/warmProspect.ts';
import { newPassToken, passExpiry, appendRung, mergePayload } from '../../shared/handoffPass.ts';
import { getOrgDomain } from '../../shared/emailDomain.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { inputs = {}, company_name, email, contact_name, report_year, pass, ref, is_demo } = body;

    const headcount = Number(inputs.headcount);
    if (!isFinite(headcount) || headcount <= 0) {
      return Response.json({ error: 'Headcount is required' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return Response.json({ error: 'A valid work email is required' }, { status: 400 });
    }
    // Aggregate only: numbers and picklists. Nothing that could carry PHI.
    for (const [k, v] of Object.entries(inputs)) {
      if (typeof v === 'string' && v.length > 120) {
        return Response.json({ error: `Field "${k}" looks like pasted report text — enter numbers and Y/N only` }, { status: 400 });
      }
    }

    await loadClaimsBenchmarks(base44);
    const results = scoreClaimsProfile(inputs);
    const campaign = recommendClaimsCampaign(results, inputs);

    const normalizedEmail = String(email).toLowerCase().trim();
    const domain = getOrgDomain(normalizedEmail);

    // ── File the contact (Client Lead) — the one warm writer ──
    const prospect = await upsertClientLead(base44, {
      email: normalizedEmail,
      contact_name,
      company_name,
      headcount,
      industry: inputs.industry || null,
      ref,
      source: 'claims_lite',
      is_demo: is_demo === true,
    });

    // ── Save the draft profile ──
    let profileId: string | null = null;
    try {
      const profile = await base44.asServiceRole.entities.ClaimsProfile.create({
        company_name: String(company_name || prospect.company_name || domain || 'Unnamed company').slice(0, 200),
        company_domain: domain || undefined,
        client_id: prospect.client_id || undefined,
        report_year: isFinite(Number(report_year)) ? Number(report_year) : new Date().getFullYear(),
        inputs,
        results: { ...results, campaign },
        confidence: results.confidence,
        benchmarks_used: currentClaimsBenchmarks().values,
        is_demo: is_demo === true,
        notes: `Self-serve quick read${ref ? ` via broker ref ${ref}` : ''}. Full report withheld for the conversation.`,
        scored_at: new Date().toISOString(),
        scored_by: normalizedEmail,
      });
      profileId = profile.id;
    } catch (err) {
      console.error('[submitClaimsLite] profile create failed:', (err as any)?.message || err);
    }

    // ── Timeline ──
    await logWarmInteraction(base44, {
      client_id: prospect.client_id,
      interaction_type: 'claims_lite_submitted',
      subject: `Claims quick read — ${results.confidence} confidence`,
      notes: [
        `Unmet-need gap: ${results.subscores.unmetNeedGap.score ?? '—'}`,
        `Shadow: ${results.subscores.comorbidityShadow.score ?? '—'}`,
        results.hiddenCost ? `Hidden cost $${Math.round(results.hiddenCost.low).toLocaleString()}–$${Math.round(results.hiddenCost.high).toLocaleString()}` : 'Hidden cost not estimable',
        `Fields provided: ${results.fieldsProvided}/${results.fieldsCounted}`,
      ].join(' · '),
    });

    // ── Extend (or start) the pass so the booking step still knows them ──
    let token = pass || null;
    const passPayload = {
      company_name: company_name || prospect.company_name || null,
      contact_name: contact_name || null,
      email: normalizedEmail,
      domain: domain || null,
      headcount,
      avg_salary: inputs.avgSalary ?? null,
      industry: inputs.industry || null,
    };
    try {
      const existing = pass
        ? (await base44.asServiceRole.entities.HandoffPass.filter({ token: pass }, '-created_date', 1))?.[0]
        : null;
      if (existing) {
        await base44.asServiceRole.entities.HandoffPass.update(existing.id, {
          source_chain: appendRung(existing.source_chain, 'claims_lite'),
          payload: mergePayload(existing.payload, passPayload),
          claims_profile_id: profileId || existing.claims_profile_id || undefined,
          client_id: prospect.client_id || existing.client_id || undefined,
          ref: existing.ref || ref || undefined,
          expires_at: passExpiry(),
        });
      } else {
        token = newPassToken();
        await base44.asServiceRole.entities.HandoffPass.create({
          token,
          source_chain: ['claims_lite'],
          payload: passPayload,
          claims_profile_id: profileId || undefined,
          client_id: prospect.client_id || undefined,
          ref: ref || undefined,
          expires_at: passExpiry(),
          is_demo: is_demo === true,
        });
      }
    } catch (err) {
      console.error('[submitClaimsLite] pass write failed:', (err as any)?.message || err);
    }

    // ── Headline only ──
    return Response.json({
      pass: token,
      profile_id: profileId,
      confidence: results.confidence,
      fields_provided: results.fieldsProvided,
      fields_counted: results.fieldsCounted,
      subscores: {
        unmetNeedGap: results.subscores.unmetNeedGap,
        comorbidityShadow: results.subscores.comorbidityShadow,
        identifiedBurden: results.subscores.identifiedBurden,
        clinicalFlags: results.subscores.clinicalFlags,
      },
      hidden_cost: results.hiddenCost
        ? { low: results.hiddenCost.low, high: results.hiddenCost.high, prevalence: results.hiddenCost.correctedPrevalence }
        : null,
      has_clinical_flags: results.hasClinicalFlags,
      recommended_stage: campaign.stage,
      known_client: prospect.is_current_client,
      company_name: prospect.company_name,
      warm_debug: prospect.debug || null,   // TEMP — remove once client filing is confirmed
    });
  } catch (err) {
    console.error('[submitClaimsLite]', (err as any)?.message || err);
    return Response.json({ error: 'Could not score that report' }, { status: 500 });
  }
});
