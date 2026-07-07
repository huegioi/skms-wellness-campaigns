import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // ── Renewal-date resolver (ported from src/lib/renewal.js — keep in sync) ──
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
    const nextCohortDate = (monthIndex, day) => {
      const year = now.getFullYear();
      let d = new Date(year, monthIndex, day);
      if (d < now) d = new Date(year + 1, monthIndex, day);
      return d;
    };
    const nextAnniversary = (baseStr) => {
      if (!baseStr) return null;
      const base = new Date(baseStr);
      if (isNaN(base.getTime())) return null;
      const year = now.getFullYear();
      let d = new Date(year, base.getMonth(), base.getDate());
      if (d < now) d = new Date(year + 1, base.getMonth(), base.getDate());
      return d;
    };
    const getEffectiveRenewalDate = (client) => {
      if (!client) return null;
      const cohort = client.renewal_cohort;
      if (cohort === 'Jan 1') return nextCohortDate(0, 1);
      if (cohort === 'July 1') return nextCohortDate(6, 1);
      if (client.renewal_date) { const d = new Date(client.renewal_date); if (!isNaN(d.getTime())) return d; }
      if (client.plan_year_start) return nextAnniversary(client.plan_year_start);
      return null;
    };

    // ── Clients ──────────────────────────────────────────────────────────────
    const allClients = await base44.asServiceRole.entities.Client.list();

    const SKIP_STAGES = new Set(['new_client_setup', 'churned', 're_engage', 'renewal_outreach']);
    const ACTIVE_STAGES = new Set(['program_delivery', 'nurture', 'followup_feedback']);
    const RENEWAL_ELIGIBLE = new Set(['program_delivery', 'nurture', 'followup_feedback', 'new_client_setup']);

    let clients_moved_to_reengage = 0;
    let clients_moved_to_renewal = 0;

    for (const client of allClients) {
      const stage = client.client_stage;

      // Skip intentionally-set stages
      if (SKIP_STAGES.has(stage)) continue;

      // Check renewal window first (higher priority) — cohort-aware resolver
      let movedToRenewal = false;
      const renewalDate = getEffectiveRenewalDate(client);
      if (renewalDate && RENEWAL_ELIGIBLE.has(stage)) {
        const daysUntil = daysBetween(now, renewalDate);
        if (daysUntil >= 0 && daysUntil <= 90) {
          await base44.asServiceRole.entities.Client.update(client.id, { client_stage: 'renewal_outreach' });
          console.log(`[CLIENT STAGE] ${client.company || client.name}: ${stage} → renewal_outreach (renews in ${daysUntil} days)`);
          clients_moved_to_renewal++;
          movedToRenewal = true;
        }
      }

      // Check re-engage (only if not moved to renewal)
      if (!movedToRenewal && ACTIVE_STAGES.has(stage) && client.last_contacted_date) {
        const daysSinceContact = (now - new Date(client.last_contacted_date)) / (1000 * 60 * 60 * 24);
        if (daysSinceContact > 60) {
          await base44.asServiceRole.entities.Client.update(client.id, { client_stage: 're_engage' });
          console.log(`[CLIENT STAGE] ${client.company || client.name}: ${stage} → re_engage (last contact ${Math.round(daysSinceContact)} days ago)`);
          clients_moved_to_reengage++;
        }
      }
    }

    // ── Partners (broker_leads) ───────────────────────────────────────────────
    const allPartners = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' });

    let partners_stalled = 0;
    let partners_needing_checkin = 0;

    for (const partner of allPartners) {
      const updates = {};

      // Stalled: follow_up_due_date > 14 days overdue and has a follow_up_stage
      if (partner.follow_up_due_date && partner.follow_up_stage) {
        const daysOverdue = (now - new Date(partner.follow_up_due_date)) / (1000 * 60 * 60 * 24);
        if (daysOverdue > 14 && !partner.is_stalled) {
          updates.is_stalled = true;
          console.log(`[PARTNER STALLED] ${partner.name} (${partner.company || 'no company'}): ${Math.round(daysOverdue)} days overdue on stage "${partner.follow_up_stage}"`);
          partners_stalled++;
        }
      }

      // Needs checkin: active_partner not contacted in 30+ days
      if (partner.partner_status === 'active_partner' && partner.last_contacted_date) {
        const daysSince = (now - new Date(partner.last_contacted_date)) / (1000 * 60 * 60 * 24);
        if (daysSince > 30 && !partner.needs_checkin) {
          updates.needs_checkin = true;
          console.log(`[PARTNER CHECKIN] ${partner.name} (${partner.company || 'no company'}): active partner, last contact ${Math.round(daysSince)} days ago`);
          partners_needing_checkin++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Lead.update(partner.id, updates);
      }
    }

    const summary = { clients_moved_to_reengage, clients_moved_to_renewal, partners_stalled, partners_needing_checkin };
    console.log('[AUTO-STAGE SUMMARY]', JSON.stringify(summary));
    return Response.json({ success: true, ...summary });

  } catch (error) {
    console.error('autoStageDetection error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});