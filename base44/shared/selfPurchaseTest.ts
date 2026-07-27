/**
 * Domain-based self-purchase test for referral commissions.
 *
 * A referral is a "self-purchase" when the paying entity IS the brokerage
 * itself — i.e. the referred Client's email domain (or any alias) matches
 * the referring partner's Brokerage email_domain. In that case no commission
 * is owed: the brokerage is buying for its own account, not referring a client.
 *
 * This replaces the older brokerage_id-match test, which cannot distinguish
 * a brokerage buying for itself from a brokerage referring a client it services
 * (both produce a matching brokerage_id).
 *
 * Free-mail domains (gmail.com, etc.) identify a person, not an organisation,
 * and are skipped via isExcludedDomain. The function returns false when either
 * side has no usable organisational domain.
 */
import { isExcludedDomain } from './emailDomain';

export interface DomainTestClient {
  email_domain?: string | null;
  email_domain_aliases?: string[] | null;
}

export interface DomainTestBrokerage {
  email_domain?: string | null;
}

/**
 * Returns true if the referred Client IS the brokerage itself — i.e. their
 * organisational email domains match.
 *
 * @param client  The referred Client (needs email_domain + email_domain_aliases)
 * @param brokerage  The referring partner's Brokerage (needs email_domain)
 * @returns true if the client's domain matches the brokerage's domain
 */
export function isSelfPurchaseByDomain(
  client: DomainTestClient | null | undefined,
  brokerage: DomainTestBrokerage | null | undefined
): boolean {
  const brokerageDomain = brokerage?.email_domain;
  if (!brokerageDomain || isExcludedDomain(brokerageDomain)) return false;

  const clientDomain = client?.email_domain;
  if (clientDomain && !isExcludedDomain(clientDomain) &&
      clientDomain.toLowerCase() === brokerageDomain.toLowerCase()) {
    return true;
  }

  const aliases = client?.email_domain_aliases || [];
  for (const alias of aliases) {
    if (!isExcludedDomain(alias) && alias.toLowerCase() === brokerageDomain.toLowerCase()) {
      return true;
    }
  }

  return false;
}