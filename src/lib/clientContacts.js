// Returns the Client update payload for a new contact list.
// Always writes the array AND re-mirrors the primary into the top-level fields,
// so every existing consumer (proposals, invoices, Gmail sync, campaigns, portal)
// keeps reading the top-level name/email/title/phone without change.
//
// The primary is the first contact with is_primary: true, falling back to the
// first contact in the list. All other contacts get is_primary: false.
export function contactsUpdate(contacts) {
  const list = contacts.map(c => ({ ...c }));
  const primary = list.find(c => c.is_primary) || list[0];
  if (!primary) return { related_contacts: [] };
  return {
    related_contacts: list.map(c => ({ ...c, is_primary: c === primary })),
    name:  primary.name  || '',
    email: primary.email || '',
    title: primary.title || '',
    phone: primary.phone || '',
  };
}