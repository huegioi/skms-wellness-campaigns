/**
 * Shared email-domain utilities for client matching, dedupe, and linking.
 * Used by backfillClientEmailDomain, createMfsAssessment, backfillInvoiceClientIds,
 * and any other path that needs to derive an organization identity key from an email.
 */

// Free-mail providers — identify a person, not an organization.
// Also excludes SkillfulMeans' own domain (internal/test accounts, never a client org).
const EXCLUDED_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'skillfulmeans.life',
]);

/**
 * Extracts the lowercased domain from an email address.
 * Returns null if the email is empty, malformed, or has no domain part.
 */
export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const atIdx = email.indexOf('@');
  if (atIdx === -1) return null;
  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  return domain || null;
}

/**
 * Returns the organization identity key (email_domain) for a given email.
 * Returns null if the domain is a free-mail provider or the SkillfulMeans
 * own domain, because those identify a person rather than an organization.
 */
export function getOrgDomain(email: string | null | undefined): string | null {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  if (EXCLUDED_DOMAINS.has(domain)) return null;
  return domain;
}

/**
 * Returns true if the domain is excluded (free-mail or SkillfulMeans own).
 */
export function isExcludedDomain(domain: string | null | undefined): boolean {
  if (!domain) return true;
  return EXCLUDED_DOMAINS.has(domain);
}

/**
 * Derives a provisional company name from an email domain.
 * e.g. "cocana@silverhillhospital.org" → "Silverhillhospital"
 * Returns null if the domain is excluded or unavailable.
 */
export function deriveCompanyFromEmail(email: string | null | undefined): string | null {
  const domain = getOrgDomain(email);
  if (!domain) return null;
  // Take the part before the TLD (last segment after the final dot)
  const parts = domain.split('.');
  if (parts.length < 2) return domain;
  // Use the main domain part, capitalized
  const main = parts[parts.length - 2];
  return main.charAt(0).toUpperCase() + main.slice(1);
}