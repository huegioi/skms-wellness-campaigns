// Domains we control. An inaccessible doc organized from one of these is
// fixable in-house; anything else is owned by an outside company.
export const INTERNAL_DOMAINS = ['skillfulmeans.life'];

export function isInternalOrganizer(email) {
  if (!email) return true; // unknown organizer — surface it, don't hide it
  const domain = String(email).split('@')[1]?.toLowerCase().trim();
  if (!domain) return true;
  return INTERNAL_DOMAINS.includes(domain);
}