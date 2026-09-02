import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getOrgDomain, deriveCompanyFromEmail } from '../../shared/emailDomain.ts';
import { buildClientRecord } from '../../shared/clientContact.ts';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Team only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { referral_id, existing_client_id, client_fields } = body;

    if (!referral_id) return Response.json({ error: 'referral_id is required' }, { status: 400 });
    if (!existing_client_id && !client_fields) {
      return Response.json({ error: 'Either existing_client_id or client_fields is required' }, { status: 400 });
    }

    // Fetch the referral
    const referral = await base44.asServiceRole.entities.Referral.get(referral_id);
    if (!referral) return Response.json({ error: 'Referral not found' }, { status: 404 });

    // Fetch the partner for attribution (fall back to referral's stored values if partner record is gone)
    let partner = null;
    if (referral.referral_partner_id) {
      try { partner = await base44.asServiceRole.entities.ReferralPartner.get(referral.referral_partner_id); }
      catch { partner = null; }
    }
    const partnerId = partner?.id || referral.referral_partner_id || '';
    const partnerName = partner?.name || referral.referral_partner_name || '';

    let clientId;

    if (existing_client_id) {
      // (a) Update existing client with referral partner info
      clientId = existing_client_id;
      await base44.asServiceRole.entities.Client.update(clientId, {
        referral_partner_id: partnerId,
        referral_partner_name: partnerName,
      });
    } else {
      // (a) Create new client from client_fields + referral partner info
      const cf = client_fields || {};
      const clientEmail = cf.email || referral.contact_email || '';
      const resolvedCompany = cf.company || referral.company_name || deriveCompanyFromEmail(clientEmail) || 'Unknown Company';
      const clientData = {
        // buildClientRecord seeds related_contacts with the referred person as
        // the primary contact, so the contact list exists from the first save.
        ...buildClientRecord({
          company: resolvedCompany,
          contactName: cf.name || referral.contact_name || '',
          email: clientEmail,
          title: cf.title,
          phone: cf.phone,
        }),
        email_domain: getOrgDomain(clientEmail),
        referral_partner_id: partnerId,
        referral_partner_name: partnerName,
        client_stage: 'new_client_setup',
      };
      const optionalFields = ['phone', 'title', 'industry', 'company_size', 'company_address', 'company_website', 'wellness_budget', 'plan_year_start', 'wellness_fund_size', 'notes', 'tags', 'brokers', 'wellness_consultant_name', 'wellness_consultant_email'];
      for (const f of optionalFields) {
        if (cf[f] !== undefined && cf[f] !== '') clientData[f] = cf[f];
      }
      const newClient = await base44.asServiceRole.entities.Client.create(clientData);
      clientId = newClient.id;
    }

    // (b) Set the Referral's referred_client_id and status — does NOT create a new Referral
    await base44.asServiceRole.entities.Referral.update(referral_id, {
      referred_client_id: clientId,
      status: 'converted_to_client',
      reviewed_date: new Date().toISOString(),
    });

    // (d) Log a ReferralActivity
    const companyLabel = client_fields?.company || referral.company_name || referral.contact_name || 'Client';
    if (partnerId) {
      await base44.asServiceRole.entities.ReferralActivity.create({
        referral_partner_id: partnerId,
        referral_id: referral_id,
        message: `${companyLabel} converted to client`,
        activity_date: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      client_id: clientId,
      referral_id: referral_id,
      partner_id: partnerId,
    });
  } catch (error) {
    console.error('convertReferralToClient error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});