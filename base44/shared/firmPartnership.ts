/**
 * Firm partnership vs. individual partner — the ONE rule.
 *
 * A Brokerage record does two jobs:
 *   1. Directory: "this firm exists" — groups its people by email domain.
 *   2. Partnership: "we have a firm-level agreement with this firm".
 *
 * Only (2) changes money. A ReferralPartner linked to a firm whose
 * partnership_status is NOT 'active' is an INDIVIDUAL partner: their own
 * commission_tiers, their own YTD, 100% of commission to them.
 * A partner linked to a firm with an ACTIVE partnership refers under the
 * firm agreement: firm tiers on firm-aggregate YTD + the firm's house/broker
 * toggles and split.
 *
 * Mirror: src/lib/firmPartnership.js — keep the two in step.
 */

export type FirmLike = { partnership_status?: string | null } | null | undefined;

export const PARTNERSHIP_STATUSES = ['none', 'prospect', 'active', 'inactive'] as const;
export const ORG_TYPES = ['brokerage', 'carrier', 'vendor', 'peo', 'consultant', 'other'] as const;

export function isFirmPartnershipActive(firm: FirmLike): boolean {
  return !!firm && firm.partnership_status === 'active';
}

/** The firm whose commission settings apply, or null when the partner is individual. */
export function commissionFirm<T extends FirmLike>(firm: T): T | null {
  return isFirmPartnershipActive(firm) ? firm : null;
}
