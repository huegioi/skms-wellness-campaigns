import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { planLeadStageMoves } from '../../shared/leadAutomation.ts';

/**
 * Moves partner leads forward on EVIDENCE (emails, calendar, campaign replies,
 * approved referrals). Forward-only, never touches closed/won or paused leads,
 * never sends anything. Rules: base44/shared/leadAutomation.ts.
 *
 * Call with { "dryRun": true } to see what it WOULD change without writing anything.
 * Not scheduled yet — scheduling it (e.g. hourly) is William's call.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const dryRun = body?.dryRun === true;

    // A scheduled run has no user; a manual call must come from an admin.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;
    const leads = await db.Lead.filter({ lead_type: 'broker_lead', is_archived: { $ne: true } }, '-created_date', 2000);
    const ids = leads.map((l: any) => l.id);
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

    const emails: any[] = [];
    const events: any[] = [];
    const recipients: any[] = [];
    for (const part of chunks) {
      const [em, ev, rc] = await Promise.all([
        db.EmailLog.filter({ matched_lead_id: { $in: part } }, '-date', 5000),
        db.CalendarEvent.filter({ lead_id: { $in: part } }, '-start_date', 2000),
        db.CampaignRecipient.filter({ record_type: 'lead', record_id: { $in: part } }, '-updated_date', 5000),
      ]);
      emails.push(...(em || []));
      events.push(...(ev || []));
      recipients.push(...(rc || []));
    }
    const [referrals, partners] = await Promise.all([
      db.Referral.list('-created_date', 2000),
      db.ReferralPartner.list('-created_date', 2000),
    ]);

    const moves = planLeadStageMoves({ leads, emails, events, recipients, referrals, partners, now: new Date() });
    const stageMoves = moves.filter((m: any) => m.from !== m.to);

    if (!dryRun) {
      for (const m of moves) {
        await db.Lead.update(m.lead.id, m.patch);
      }
      // Keep the Google Sheet's Pipeline Stage column in step (best effort)
      for (const m of stageMoves) {
        await base44.asServiceRole.functions.invoke('syncBrokerLeadsSheet', {
          action: 'updatePipelineStage',
          leadId: m.lead.id,
          email: m.lead.email,
          sheetRowId: m.lead.sheet_row_id,
          sheetName: m.lead.sheet_origin?.replace('BrokerLeads:', '') || 'Referral Partners',
          status: m.to,
        }).catch((e: any) => console.warn('sheet sync failed', m.lead.id, e?.message));
      }
    }

    return Response.json({
      dry_run: dryRun,
      leads_checked: leads.length,
      stage_moves: stageMoves.map((m: any) => ({ name: m.lead.name, company: m.lead.company, from: m.from, to: m.to, why: m.reason })),
      housekeeping_only: moves.length - stageMoves.length,
    });
  } catch (error) {
    console.error('advanceLeadStages error:', (error as any)?.message);
    return Response.json({ error: (error as any)?.message }, { status: 500 });
  }
});
