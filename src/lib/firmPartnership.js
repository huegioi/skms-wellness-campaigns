/**
 * Firm partnership vs. individual partner — frontend mirror of
 * base44/shared/firmPartnership.ts. Keep the two in step.
 *
 * A Brokerage record is a firm in the directory. Only a firm whose
 * partnership_status is 'active' has a firm-level deal; its commission
 * settings apply to the people linked to it. Everyone else is an
 * individual partner who happens to work at that firm.
 */

export const PARTNERSHIP_STATUS = {
  none:     { label: 'Directory only', short: 'No firm deal', className: 'bg-gray-100 text-gray-500' },
  prospect: { label: 'Firm partnership — prospect', short: 'Prospect', className: 'bg-amber-100 text-amber-800' },
  active:   { label: 'Firm partnership — active', short: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  inactive: { label: 'Firm partnership — inactive', short: 'Inactive', className: 'bg-gray-200 text-gray-600' },
};

export const ORG_TYPE = {
  brokerage:  { label: 'Brokerage' },
  carrier:    { label: 'Carrier / health plan' },
  vendor:     { label: 'Vendor / solution partner' },
  peo:        { label: 'PEO' },
  consultant: { label: 'Consultant' },
  other:      { label: 'Other' },
};

export function orgTypeLabel(firm) {
  return ORG_TYPE[firm?.org_type || 'brokerage']?.label || 'Brokerage';
}

export function partnershipStatus(firm) {
  return PARTNERSHIP_STATUS[firm?.partnership_status || 'none'] ? (firm?.partnership_status || 'none') : 'none';
}

export function isFirmPartnershipActive(firm) {
  return !!firm && firm.partnership_status === 'active';
}

/** True for any firm with a partnership in some stage (prospect/active/inactive). */
export function hasFirmPartnership(firm) {
  return partnershipStatus(firm) !== 'none';
}

/**
 * How a referral partner relates to SkillfulMeans.
 * Returns { kind: 'firm' | 'individual', firm, label }
 *   firm       → refers under an ACTIVE firm agreement
 *   individual → their own deal (firm, if any, is just where they work)
 */
export function partnerRelationship(partner, brokerages = []) {
  const firm = partner?.brokerage_id ? brokerages.find(b => b.id === partner.brokerage_id) || null : null;
  if (isFirmPartnershipActive(firm)) {
    return { kind: 'firm', firm, label: `Under ${firm.name} agreement` };
  }
  return { kind: 'individual', firm, label: 'Individual partner' };
}
