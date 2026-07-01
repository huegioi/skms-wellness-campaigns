import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * One-time backfill: for every Lead at partner_status='active_partner' with no
 * matching ReferralPartner by email, create/link the ReferralPartner and generate
 * a portal ID. Also patches active ReferralPartner records with no portal ID.
 *
 * NO EMAILS ARE SENT. Returns a full list of provisioned partners (name, email,
 * portal_url) so links can be shared by hand.
 *
 * Admin-only.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const appBaseUrl = 'https://curriculum-designer-05b51a3b.base44.app';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const results = {
    provisioned: [],          // { name, email, portal_url, action }
    skipped_no_email: [],     // { name, email, source }
    already_had_portal: [],   // { name, email, portal_url }
  };

  function makePortalId() {
    return crypto.randomUUID();
  }

  // ── 1. Load all ReferralPartner records ──────────────────────────────────
  const allPartners = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 500);

  // Track by email (lower) for fast lookup
  const partnerByEmail = {};
  for (const p of allPartners) {
    if (p.email) partnerByEmail[p.email.toLowerCase()] = p;
  }

  // ── 2. Patch active ReferralPartner records that are missing a portal ────
  const activeWithoutPortal = allPartners.filter(p =>
    (p.is_active === true || p.partner_status === 'Active Partner') && !p.unique_portal_id
  );

  for (const partner of activeWithoutPortal) {
    if (!partner.email || !emailRegex.test(partner.email)) {
      results.skipped_no_email.push({ name: partner.name, email: partner.email || '(none)', source: 'ReferralPartner' });
      continue;
    }
    const portalId = makePortalId();
    await base44.asServiceRole.entities.ReferralPartner.update(partner.id, {
      unique_portal_id: portalId,
      is_active: true,
    });
    // Update our local lookup too so step 3 sees the new portal
    partnerByEmail[partner.email.toLowerCase()] = { ...partner, unique_portal_id: portalId };
    const portalUrl = `${appBaseUrl}/ReferralPortal?id=${portalId}`;
    results.provisioned.push({
      name: partner.name,
      email: partner.email,
      portal_url: portalUrl,
      action: 'patched_existing_partner',
    });
  }

  // ── 3. Walk active_partner Leads — upsert ReferralPartner ───────────────
  const activeLeads = await base44.asServiceRole.entities.Lead.filter(
    { partner_status: 'active_partner', lead_type: 'broker_lead' },
    '-created_date',
    500
  );

  for (const lead of activeLeads) {
    if (!lead.email || !emailRegex.test(lead.email)) {
      results.skipped_no_email.push({ name: lead.name, email: lead.email || '(none)', source: 'Lead' });
      continue;
    }

    const emailLower = lead.email.toLowerCase();
    const existing = partnerByEmail[emailLower];

    if (existing) {
      if (existing.unique_portal_id) {
        // Already has portal — nothing to do
        results.already_had_portal.push({
          name: existing.name,
          email: existing.email,
          portal_url: `${appBaseUrl}/ReferralPortal?id=${existing.unique_portal_id}`,
        });
      } else {
        // Shouldn't happen (step 2 patched these) but handle defensively
        const portalId = makePortalId();
        await base44.asServiceRole.entities.ReferralPartner.update(existing.id, {
          unique_portal_id: portalId,
          is_active: true,
          partner_status: 'Active Partner',
        });
        const portalUrl = `${appBaseUrl}/ReferralPortal?id=${portalId}`;
        partnerByEmail[emailLower] = { ...existing, unique_portal_id: portalId };
        results.provisioned.push({
          name: existing.name,
          email: existing.email,
          portal_url: portalUrl,
          action: 'patched_existing_partner_via_lead',
        });
      }
    } else {
      // No ReferralPartner exists — create one from Lead data
      const portalId = makePortalId();
      const newPartner = await base44.asServiceRole.entities.ReferralPartner.create({
        name: lead.name,
        email: lead.email,
        company: lead.company || '',
        phone: lead.phone || '',
        is_active: true,
        partner_status: 'Active Partner',
        unique_portal_id: portalId,
        notes: `Auto-created from Lead ${lead.id} during backfill on ${new Date().toISOString().split('T')[0]}`,
      });
      partnerByEmail[emailLower] = newPartner;
      const portalUrl = `${appBaseUrl}/ReferralPortal?id=${portalId}`;
      results.provisioned.push({
        name: lead.name,
        email: lead.email,
        portal_url: portalUrl,
        action: 'created_new_partner_from_lead',
      });
    }
  }

  return Response.json({
    summary: {
      provisioned_count: results.provisioned.length,
      already_had_portal_count: results.already_had_portal.length,
      skipped_no_email_count: results.skipped_no_email.length,
      note: 'No emails sent. Share portal links below by hand.',
    },
    provisioned: results.provisioned,
    already_had_portal: results.already_had_portal,
    skipped_no_email: results.skipped_no_email,
  });
});