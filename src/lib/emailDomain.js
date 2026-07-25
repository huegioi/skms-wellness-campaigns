/**
 * Frontend mirror of base44/shared/emailDomain.ts.
 * Used by Client creation forms to compute email_domain before the API call.
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