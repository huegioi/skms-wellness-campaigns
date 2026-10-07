import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { runLeadStageAutomation } from '../../shared/leadAutomationRunner.ts';

/**
 * Nightly safety sweep over EVERY partner lead (workflow "Advance Lead Stages - Nightly").
 * Day to day, leads move right after the Gmail / calendar / campaign / referral updates
 * that call the same check (base44/shared/leadAutomationRunner.ts); this catches anything
 * those missed (e.g. a Gmail connection that was down).
 *
 * Forward-only, never touches closed/won/paused leads, never sends anything.
 * Admins can call it with { "dryRun": true } to see what it WOULD change, or with
 * { "leadIds": [...] } to check specific leads.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch { /* scheduled run: no body */ }

    // A scheduled run has no user; a manual call must come from an admin.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = await runLeadStageAutomation(base44, {
      leadIds: Array.isArray(body?.leadIds) ? body.leadIds : null,
      dryRun: body?.dryRun === true,
    });
    return Response.json({ dry_run: body?.dryRun === true, ...result });
  } catch (error) {
    console.error('advanceLeadStages error:', (error as any)?.message);
    return Response.json({ error: (error as any)?.message }, { status: 500 });
  }
});
