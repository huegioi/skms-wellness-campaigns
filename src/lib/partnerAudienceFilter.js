/**
 * Shared partner-audience inclusion criteria.
 *
 * Used by:
 *   - WizardStepAudience.jsx (wizard preview)
 *   - base44/functions/buildCampaignAudience/entry.ts (backend — mirrored, keep in sync)
 *
 * When audience_type === 'partner' and audience_scope === 'all', only records
 * that would appear on the Partners page are included:
 *   - Leads with lead_type === 'broker_lead' (the "Referral Partners" tab)
 *   - ReferralPartners (the "Referral Portals" tab)
 * Dead/lost leads and inactive referral partners are also excluded.
 *
 * Tag scope ('by tag') does NOT apply this filter — explicitly tagged records
 * are always included (enables re-engagement campaigns targeting inactive partners).
 */

/** Lead.status values that represent dead/lost/converted leads. */
export const DEAD_LEAD_STATUSES = ['not_interested', 'converted', 'current_client'];

/**
 * Returns true if a Lead record is dead/lost and should be excluded from
 * "All Partners" audience (but NOT from tag-based audiences).
 */
export function isDeadLead(lead) {
  return DEAD_LEAD_STATUSES.includes(lead.status);
}

/**
 * Returns true if a Lead record is the wrong lead_type for the Partners page.
 * The Partners page only shows leads with lead_type === 'broker_lead'.
 * Old imported leads (unset), 'broker' (cold outreach), 'ec', and
 * 'company_inquiry' (Quick Builder) are excluded from "All Partners".
 */
export function isWrongLeadType(lead) {
  return lead.lead_type !== 'broker_lead';
}

/**
 * Returns true if a ReferralPartner record is inactive and should be excluded
 * from "All Partners" audience (but NOT from tag-based audiences).
 */
export function isInactiveReferralPartner(partner) {
  return partner.partner_status === 'Inactive' || partner.is_active === false;
}

/**
 * Unified predicate: returns true if a record (tagged with _sourceType)
 * should be EXCLUDED from "All Partners" scope.
 *
 * @param {object} r - record with _sourceType ('lead' | 'referral_partner' | 'client')
 * @returns {boolean} true = exclude from All Partners audience
 */
export function isExcludedFromAllPartners(r) {
  if (r._sourceType === 'lead') return isWrongLeadType(r) || isDeadLead(r);
  if (r._sourceType === 'referral_partner') return isInactiveReferralPartner(r);
  return false;
}