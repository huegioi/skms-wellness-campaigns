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
  const primary = pickPrimary(list, client);
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

// Which contact is the primary?
//
// The old rule was `find(is_primary) || list[0]`, and list[0] is a trap: most
// Client records were created with an EMPTY related_contacts array, so the first
// contact anyone added — a broker, a wellness consultant, anybody — became the
// primary and silently overwrote the client's name/email/title/phone. Adding a
// broker must never repoint the client's contact.
//
// Order of preference:
//   1. an explicit is_primary flag
//   2. the contact whose email matches the client's current primary email
//      (i.e. leave the existing primary where it is)
//   3. the first contact who is not a broker or wellness consultant
//   4. list[0], only when there is genuinely nothing else to go on
function pickPrimary(list, client) {
  const explicit = list.find(c => c.is_primary);
  if (explicit) return explicit;

  const currentEmail = key(client && client.email);
  if (currentEmail) {
    const incumbent = list.find(c => key(c && c.email) === currentEmail);
    if (incumbent) return incumbent;
  }

  const THIRD_PARTY = new Set(['broker', 'wellness_consultant']);
  const internal = list.find(c => !THIRD_PARTY.has(c && c.contact_type));
  if (internal) return internal;

  return list[0];
}

// Build a well-formed Client payload from intake fields.
//
// USE THIS IN EVERY PATH THAT CREATES A CLIENT. It is the write-side counterpart
// of resolveClientContact: the organization goes in `company`, the person goes in
// `name`, and the person is ALSO seeded into related_contacts so the contact list
// and the mirrored top-level fields agree from the very first save. Creation
// paths that skipped related_contacts are why adding a broker could overwrite a
// client's contact, and why so many records ended up with the org in `name`.
//
// `contactName` may be empty — an unknown contact is a data gap to surface, not
// something to fill with the company name. `Client.name` is a required field, so
// it falls back to the company; resolveClientContact reads name === company as
// "no contact known" and the UI flags it for follow-up.
export function buildClientRecord({
  company,
  contactName,
  email,
  title,
  phone,
  notes,
  contactType,
} = {}) {
  const org = norm(company);
  const person = norm(contactName);
  const addr = norm(email);
  const usablePerson = person && !looksLikeOrganization(person, org) ? person : '';

  const payload = {
    company: org,
    name: usablePerson || org,
    email: addr,
    title: norm(title),
    phone: norm(phone),
  };

  const domain = getOrgDomain(addr);
  if (domain) payload.email_domain = domain;

  if (usablePerson || addr) {
    payload.related_contacts = [{
      name: usablePerson,
      email: addr,
      title: norm(title),
      phone: norm(phone),
      notes: norm(notes),
      contact_type: norm(contactType) || 'other',
      is_primary: true,
    }];
  }

  return payload;
}

// ═══════════════════════════════════════════════════════════════════════════
// WHO IS THE HUMAN AT THIS CLIENT?
//
// `Client.name` is documented as "Primary contact name", but on a large slice
// of real records it holds the ORGANIZATION instead (name === company), with
// the actual person sitting in `related_contacts` — or nowhere at all. The
// app-wide `company || name` display fallback hides this, because every screen
// renders the company either way. It only surfaces where a Client must be
// rendered as a PERSON: campaign greetings, proposal headers, calendar
// invites, QuickBooks GivenName/FamilyName.
//
// Every one of those paths must go through this resolver instead of reading
// `client.name` directly.
//
// ── THE RULE ──────────────────────────────────────────────────────────────
// A contact name is only usable for an email address if it BELONGS to that
// address. Silver Hill's record email is caherne@ (Christy Aherne) while its
// related contact is Carolina Ocana (cocana@); pairing "Carolina" with
// caherne@ would mail the wrong name to the wrong person. So the match is made
// on email — never "grab the first human you can find on the record".
//
// ── NEVER GUESS FROM AN EMAIL ADDRESS ─────────────────────────────────────
// `adileone@region16ct.org` is Tony DiLeone, not "Adi". A campaign draft that
// greeted "Hi Adi," is why this exists. When no human is known for an address,
// `firstName` comes back null and the caller greets neutrally. An unknown name
// is a data gap to surface, not a blank to fill in.
//
// KEEP IN SYNC with base44/shared/clientContact.ts — Deno functions cannot
// import from src/, and Vite cannot import from base44/shared.
// ═══════════════════════════════════════════════════════════════════════════

// Tokens that only ever END an organization's name. Deliberately conservative:
// a false positive costs a first name (safe — we greet neutrally), a false
// negative mails an org name as a person (the bug).
const ORG_TAIL =
  /(?:^|[\s,.])(inc|llc|l\.l\.c|llp|lllp|ltd|plc|corp|corporation|co|company|group|holdings?|partners|associates|institute|academy|university|college|district|hospital|clinic|health|healthcare|systems?|foundation|association|society|council|coalition|services|solutions|consulting|consultants|technologies|industries|international|enterprises?|capital|ventures|advisors|advisers|management)\.?$/i;

const HONORIFIC = /^(dr|mr|mrs|ms|miss|prof|professor|rev|sir|fr)\.?$/i;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).toLowerCase();

// True when this string reads as an organization rather than a person.
export function looksLikeOrganization(name, company) {
  const n = norm(name);
  if (!n) return true;
  // The exact defect: the org name was typed into the contact field.
  if (company && key(n) === key(company)) return true;
  if (ORG_TAIL.test(n)) return true;
  return false;
}

// Greeting name from a full name, or null. Honorifics are skipped so
// "Dr. Emily Chen" greets as "Emily". Returns null for anything empty —
// callers must handle null rather than substituting a guess.
export function firstNameOf(name) {
  const n = norm(name);
  if (!n) return null;
  const parts = n.split(' ').map(p => p.replace(/[,;]+$/, '')).filter(Boolean);
  if (parts.length === 0) return null;
  if (HONORIFIC.test(parts[0]) && parts.length > 1) return parts[1] || null;
  return parts[0] || null;
}

// Resolve the human behind ONE email address on a Client.
// `forEmail` is the address being written to (defaults to client.email).
// Returns { name, firstName, email, title, phone, source, confidence }.
export function resolveClientContact(client, forEmail) {
  const c = client || {};
  const targetRaw = norm(forEmail) || norm(c.email);
  const target = key(targetRaw);
  const contacts = Array.isArray(c.related_contacts) ? c.related_contacts : [];

  const unknown = {
    name: null,
    firstName: null,
    email: targetRaw,
    title: '',
    phone: '',
    source: 'none',
    confidence: 'none',
  };

  if (!target) return unknown;

  // 1. The contact that OWNS this address.
  const owner = contacts.find(x => key(x && x.email) === target);
  if (owner && !looksLikeOrganization(owner.name, c.company)) {
    return {
      name: norm(owner.name),
      firstName: firstNameOf(owner.name),
      email: norm(owner.email) || targetRaw,
      title: norm(owner.title),
      phone: norm(owner.phone),
      source: 'related_contact',
      confidence: 'high',
    };
  }

  // 2. The mirrored top-level fields — but only when they describe THIS address
  //    and read as a person.
  if (key(c.email) === target && !looksLikeOrganization(c.name, c.company)) {
    return {
      name: norm(c.name),
      firstName: firstNameOf(c.name),
      email: norm(c.email),
      title: norm(c.title),
      phone: norm(c.phone),
      source: 'client_record',
      confidence: 'high',
    };
  }

  // 3. No human is known for this address. Say so.
  return unknown;
}

// True when this Client has no usable human name on its primary address.
export function isMissingContactName(client) {
  return resolveClientContact(client).confidence === 'none';
}

// Every human on file at this client, for context (e.g. a contacts panel).
// Rows that are really the organization are dropped, so a caller never sees
// "International Fund for Animal Welfare" presented as a person.
export function listClientContacts(client) {
  const c = client || {};
  const contacts = Array.isArray(c.related_contacts) ? c.related_contacts : [];
  const out = [];
  const seen = new Set();

  for (const x of contacts) {
    const name = norm(x && x.name);
    const email = norm(x && x.email);
    if (!name && !email) continue;
    if (looksLikeOrganization(name, c.company)) continue;
    const k = key(email) || key(name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      name,
      email,
      title: norm(x && x.title),
      phone: norm(x && x.phone),
      is_primary: !!(x && x.is_primary),
      contact_type: norm(x && x.contact_type) || 'other',
    });
  }

  // The mirrored top-level person, when related_contacts doesn't already carry it.
  const top = norm(c.name);
  const topKey = key(c.email) || key(top);
  if (top && !looksLikeOrganization(top, c.company) && !seen.has(topKey)) {
    out.unshift({
      name: top,
      email: norm(c.email),
      title: norm(c.title),
      phone: norm(c.phone),
      is_primary: true,
      contact_type: 'other',
    });
  }

  return out;
}

// The client's display identity — the organization, always.
export function clientOrgName(client) {
  const c = client || {};
  return norm(c.company) || norm(c.name) || '';
}