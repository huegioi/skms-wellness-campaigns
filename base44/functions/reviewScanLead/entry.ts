import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { upsertClientLead } from '../../shared/warmProspect.ts';

/**
 * Timeline entry on the Client / Partner record. Written here rather than via
 * warmProspect's logWarmInteraction, whose values (channel 'web', custom
 * interaction types) fail ClientInteraction's enums and are silently dropped.
 */
async function logScanTouch(base44: any, target: { client_id?: string; referral_partner_id?: string }, scan: any, reviewer: string) {
  try {
    await base44.asServiceRole.entities.ClientInteraction.create({
      ...target,
      interaction_type: 'note',
      channel: 'other',
      date: scan.created_date || new Date().toISOString(),
      subject: `Conference QR scan — ${scan.source_label || scan.source_key}`,
      notes: `${scan.name || 'Visitor'}${scan.company ? ` (${scan.company})` : ''} <${scan.email}> scanned the ${scan.source_label || scan.source_key} code and left their details. Filed from the Review Queue by ${reviewer}.`,
      owner: reviewer.toLowerCase().startsWith('heather') ? 'Heather' : 'William',
    });
  } catch (err) {
    console.error('[reviewScanLead] timeline write failed:', (err as any)?.message || err);
  }
}

/**
 * Signed-in only — the Dashboard Review Queue's actions on a conference scan.
 *
 *   add_client  → Client Lead via upsertClientLead (the warm pipeline's ONE
 *                 writer; matches by email domain, never creates a company for
 *                 a free-mail address)
 *   add_partner → Partner Lead: ReferralPartner, partner_status 'Prospect',
 *                 matched by email so a known partner is never duplicated
 *   dismiss     → marked dismissed, nothing filed
 *
 * Never writes to the legacy Lead table (William, 2026-08-16). Never emails
 * the contact — outreach stays by hand.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { scan_id, action, review_notes } = await req.json().catch(() => ({}));
  if (!scan_id || !['add_client', 'add_partner', 'dismiss'].includes(action)) {
    return Response.json({ error: 'scan_id and a valid action are required' }, { status: 400 });
  }

  const scan = (await base44.asServiceRole.entities.ScanLead.filter({ id: scan_id }))?.[0];
  if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });
  if (scan.status !== 'pending_review') {
    return Response.json({ error: 'This scan has already been reviewed' }, { status: 409 });
  }

  const reviewed = {
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.email,
    ...(review_notes ? { review_notes: String(review_notes).slice(0, 1000) } : {}),
  };
  const sourceText = `conference QR scan (${scan.source_label || scan.source_key})`;

  if (action === 'dismiss') {
    await base44.asServiceRole.entities.ScanLead.update(scan.id, { status: 'dismissed', ...reviewed });
    return Response.json({ ok: true, status: 'dismissed' });
  }

  if (action === 'add_client') {
    const res = await upsertClientLead(base44, {
      email: scan.email,
      contact_name: scan.name || null,
      company_name: scan.company || null,
      source: sourceText,
    });
    if (!res.client_id) {
      // Almost always a personal address (gmail etc.) — there's no company to
      // file it under. Say so plainly and leave the scan pending.
      return Response.json({
        error: 'This looks like a personal email, so there is no company to file it under. Add them as a Partner Lead, or dismiss and follow up by hand.',
        debug: res.debug,
      }, { status: 422 });
    }
    await logScanTouch(base44, { client_id: res.client_id }, scan, user.email);
    await base44.asServiceRole.entities.ScanLead.update(scan.id, {
      status: 'added_client_lead', client_id: res.client_id, ...reviewed,
    });
    return Response.json({
      ok: true, status: 'added_client_lead', client_id: res.client_id,
      existing: res.existing, is_current_client: res.is_current_client, company_name: res.company_name,
    });
  }

  // add_partner
  const emailLower = String(scan.email).toLowerCase();
  const matches = await base44.asServiceRole.entities.ReferralPartner.filter({ email: emailLower }, '-created_date', 1);
  let partner = matches?.[0] || null;
  let existing = true;
  if (!partner) {
    existing = false;
    partner = await base44.asServiceRole.entities.ReferralPartner.create({
      name: scan.name || emailLower,
      email: emailLower,
      ...(scan.company ? { company: scan.company } : {}),
      partner_status: 'Prospect',
      is_active: false,
      unique_portal_id: crypto.randomUUID(),
      notes: `Partner Lead — first seen via ${sourceText} on ${new Date().toISOString().slice(0, 10)}.`,
    });
  }
  await logScanTouch(base44, { referral_partner_id: partner.id }, scan, user.email);
  await base44.asServiceRole.entities.ScanLead.update(scan.id, {
    status: 'added_partner_lead', referral_partner_id: partner.id, ...reviewed,
  });
  return Response.json({ ok: true, status: 'added_partner_lead', referral_partner_id: partner.id, existing });
});
