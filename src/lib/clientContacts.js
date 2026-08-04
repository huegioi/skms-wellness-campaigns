import { getOrgDomain } from '@/lib/emailDomain';

// Returns the Client update payload for a new contact list.
// Always writes the array AND re-mirrors the primary into the top-level fields,
// so every existing consumer (proposals, invoices, Gmail sync, campaigns, portal)
// keeps reading the top-level name/email/title/phone without change.
//
// The primary is the first contact with is_primary: true, falling back to the
// first contact in the list. All other contacts get is_primary: false.
//
// `client` (optional) is the current Client record. It is used ONLY to check
// whether a domain already exists when the new primary's email is free-mail
// (getOrgDomain returns null). In that case we keep the existing domain rather
// than blanking the org identity key. Do not read anything else from it.
export function contactsUpdate(contacts, client) {
  const list = contacts.map(c => ({ ...c }));
  const primary = list.find(c => c.is_primary) || list[0];
  if (!primary) return { related_contacts: [] };

  const nextDomain = getOrgDomain(primary.email);

  const payload = {
    related_contacts: list.map(c => ({ ...c, is_primary: c === primary })),
    name:  primary.name  || '',
    email: primary.email || '',
    title: primary.title || '',
    phone: primary.phone || '',
  };

  // Only overwrite when the new primary has a real organization domain.
  // getOrgDomain returns null for free-mail (gmail, outlook, ...) and for
  // skillfulmeans.life — in those cases keep whatever domain the record
  // already had rather than blanking the org identity key.
  if (nextDomain) {
    payload.email_domain = nextDomain;
  }

  return payload;
}