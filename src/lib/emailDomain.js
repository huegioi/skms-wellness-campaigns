/**
 * Frontend mirror of base44/shared/emailDomain.ts.
 *
 * SOURCE OF TRUTH: base44/shared/emailDomain.ts — that Deno module is the
 * canonical implementation. It cannot be imported from the frontend (Vite
 * ESM vs Deno runtime), so this file is a deliberate mirror. The
 * EXCLUDED_DOMAINS set MUST be kept in sync with the backend module;
 * if a domain is added or removed there, update it here too.
 *
 * Used by Client creation forms and BrokeragePicker to derive organization
 * identity keys from email addresses.
 */

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
 * Returns true if the domain is excluded (free-mail or SkillfulMeans own).
 * Mirrors isExcludedDomain from base44/shared/emailDomain.ts.
 */
export function isExcludedDomain(domain) {
  if (!domain) return true;
  return EXCLUDED_DOMAINS.has(domain);
}

export function extractEmailDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const atIdx = email.indexOf('@');
  if (atIdx === -1) return null;
  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  return domain || null;
}

export function getOrgDomain(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  if (EXCLUDED_DOMAINS.has(domain)) return null;
  return domain;
}

export function deriveCompanyFromEmail(email) {
  const domain = getOrgDomain(email);
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length < 2) return domain;
  const main = parts[parts.length - 2];
  return main.charAt(0).toUpperCase() + main.slice(1);
}