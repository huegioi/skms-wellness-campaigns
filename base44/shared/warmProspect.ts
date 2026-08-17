/**
 * ══════════════════════════════════════════════════════════════════════════
 *  WARM PROSPECT — the ONE writer for warming-engine contacts.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * William's rule (2026-08-17): the warming engine NEVER writes to the legacy
 * `Lead` table. Contacts it produces are filed from their first form as
 *   · Client Lead  — Client, is_assessment_lead: true (the prospect state)
 *   · Partner Lead — ReferralPartner, partner_status: 'Prospect'
 * and are promoted later by a status flip, never a migration:
 *   · Client Lead  → Client          on ACCEPTED PROPOSAL (unlockAssessmentLead)
 *   · Partner Lead → Active Partner  on FIRST APPROVED REFERRAL
 *
 * Roles are additive: a brokerage that both refers and buys (Brown & Brown)
 * legitimately holds both, bound by brokerage_id and email domain. The
 * commission guard for that case already exists — see selfPurchaseTest.ts.
 *
 * Matching is by email DOMAIN, never by name and never by a single address
 * (companies-are-the-client). Free-mail domains identify a person, not an
 * organisation, so they never create or match a company.
 */
import { getOrgDomain, extractEmailDomain } from './emailDomain.ts';

export interface WarmContactInput {
  email?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  headcount?: number | null;
  industry?: string | null;
  ref?: string | null;
  source: string;          // the rung that produced this contact
  is_demo?: boolean;
}

export interface WarmProspectResult {
  /**
   * Why no Client was filed, when one wasn't. Written into the profile's notes
   * so a silent filing failure is visible in the record rather than only in a
   * log nobody reads — this is how the missing-`company` bug hid.
   */
  debug?: string;
  client_id: string | null;
  /** True when the Client already existed — an established client or an
   *  earlier warm touch. Drives the "welcome back" state in the UI. */
  existing: boolean;
  /** True when the matched Client is a real client, not a prospect. */
  is_current_client: boolean;
  company_name: string | null;
  domain: string | null;
}

/**
 * Find-or-create the Client record behind a warming-tool submission.
 *
 * Never touches `Lead`. Never creates a company for a free-mail address —
 * those stay contact-level until an organisational domain shows up.
 */
export async function upsertClientLead(
  base44: any,
  input: WarmContactInput,
): Promise<WarmProspectResult> {
  const domain = getOrgDomain(input.email);
  const blank: WarmProspectResult = {
    client_id: null, existing: false, is_current_client: false,
    company_name: input.company_name || null, domain: extractEmailDomain(input.email),
  };
  if (!domain) return { ...blank, debug: `no org domain from "${input.email}"` };

  // ── Match on domain, primary then aliases ──
  let existing: any = null;
  try {
    const primary = await base44.asServiceRole.entities.Client.filter({ email_domain: domain }, '-created_date', 1);
    existing = primary?.[0] || null;
    if (!existing) {
      const aliased = await base44.asServiceRole.entities.Client.filter(
        { email_domain_aliases: domain }, '-created_date', 1,
      );
      existing = aliased?.[0] || null;
    }
  } catch (err) {
    const detail = `${(err as any)?.message || err}`;
    console.error('[warmProspect] client lookup failed:', detail);
    return { ...blank, debug: `lookup: ${detail}`.slice(0, 500) };
  }

  if (existing) {
    // An existing record — established client OR an earlier warm touch.
    // Fill only genuinely missing facts; never overwrite what William curates.
    const patch: Record<string, unknown> = {};
    if (!existing.employee_count && input.headcount) patch.employee_count = input.headcount;
    if (!existing.industry && input.industry) patch.industry = input.industry;
    if (Object.keys(patch).length > 0) {
      try { await base44.asServiceRole.entities.Client.update(existing.id, patch); }
      catch (err) { console.error('[warmProspect] client patch failed:', (err as any)?.message || err); }
    }
    return {
      client_id: existing.id,
      existing: true,
      // is_assessment_lead true = still a prospect. Anything else is a client.
      is_current_client: existing.is_assessment_lead !== true,
      company_name: existing.name || existing.company || input.company_name || null,
      domain,
    };
  }

  // ── New Client Lead ──
  // Client requires name, email AND company — omitting `company` silently
  // fails validation and leaves an orphan profile with no client_id.
  const orgName = (input.company_name || domain).toString().slice(0, 200);
  try {
    const created = await base44.asServiceRole.entities.Client.create({
      name: orgName,
      company: orgName,
      email: input.email || undefined,
      email_domain: domain,
      industry: input.industry || undefined,
      employee_count: input.headcount || undefined,
      client_stage: 'event_follow_up',
      // The prospect state: excluded from revenue, renewals, follow-up queues
      // and Maya counts until a proposal is accepted.
      is_assessment_lead: true,
      is_demo: input.is_demo === true,
      notes: `Warm pipeline — first seen via ${input.source}${input.ref ? ` (broker ref ${input.ref})` : ''}.`,
    });
    return {
      client_id: created.id, existing: false, is_current_client: false,
      company_name: created.name, domain,
    };
  } catch (err) {
    const detail = `${(err as any)?.message || err} :: ${JSON.stringify((err as any)?.response?.data || (err as any)?.body || {})}`;
    console.error('[warmProspect] client create failed:', detail);
    return { ...blank, debug: `create: ${detail}`.slice(0, 500) };
  }
}

/**
 * Records the tool touch on the shared timeline. New interaction TYPES, never
 * new columns — the lead board and client detail already render these.
 */
export async function logWarmInteraction(
  base44: any,
  { client_id, referral_partner_id, interaction_type, subject, notes }: {
    client_id?: string | null; referral_partner_id?: string | null;
    interaction_type: string; subject: string; notes?: string;
  },
): Promise<void> {
  if (!client_id && !referral_partner_id) return;
  try {
    await base44.asServiceRole.entities.ClientInteraction.create({
      client_id: client_id || undefined,
      referral_partner_id: referral_partner_id || undefined,
      interaction_type,
      channel: 'web',
      date: new Date().toISOString(),
      subject,
      notes: notes || undefined,
      owner: 'warming-engine',
    });
  } catch (err) {
    // Never fail a visitor's submission because the timeline write failed.
    console.error('[warmProspect] interaction log failed:', (err as any)?.message || err);
  }
}
