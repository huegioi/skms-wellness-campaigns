/**
 * WHO IS THE HUMAN AT THIS CLIENT?
 *
 * `Client.name` is documented as "Primary contact name", but on a large slice of
 * real records it holds the ORGANIZATION instead (name === company), with the
 * actual person sitting in `related_contacts` — or nowhere at all. The app-wide
 * `company || name` display fallback hides this, because every screen renders the
 * company either way. It only surfaces where a Client must be rendered as a
 * PERSON: campaign greetings, proposal headers, calendar invites, QuickBooks
 * GivenName/FamilyName.
 *
 * Every one of those paths must go through this resolver instead of reading
 * `client.name` directly.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────────
 * A contact name is only usable for an email address if it BELONGS to that
 * address. Silver Hill's record email is caherne@ (Christy Aherne) while its
 * related contact is Carolina Ocana (cocana@); pairing "Carolina" with caherne@
 * would mail the wrong name to the wrong person. So the match is made on email —
 * never "grab the first human you can find on the record".
 *
 * ── NEVER GUESS FROM AN EMAIL ADDRESS ─────────────────────────────────────────
 * `adileone@region16ct.org` is Tony DiLeone, not "Adi". A campaign draft that
 * greeted "Hi Adi," is why this file exists. When no human is known for an
 * address, `firstName` comes back null and the caller greets neutrally. An
 * unknown name is a data gap to surface, not a blank to fill in.
 *
 * KEEP IN SYNC with the frontend copy at src/lib/clientContacts.js — Deno
 * functions cannot import from src/, and Vite cannot import from base44/shared.
 */

import { getOrgDomain } from './emailDomain.ts';

type AnyRecord = Record<string, any>;

export type ContactSource = 'related_contact' | 'client_record' | 'none';
export type ContactConfidence = 'high' | 'none';

export interface ResolvedContact {
  /** Full human name, or null when no human is known for this address. */
  name: string | null;
  /** Greeting name, or null. NEVER derived from an email address. */
  firstName: string | null;
  email: string;
  title: string;
  phone: string;
  source: ContactSource;
  confidence: ContactConfidence;
}

/**
 * Tokens that only ever END an organization's name. Deliberately conservative:
 * a false positive costs a first name (safe — we greet neutrally), a false
 * negative mails an org name as a person (the bug).
 */
const ORG_TAIL =
  /(?:^|[\s,.])(inc|llc|l\.l\.c|llp|lllp|ltd|plc|corp|corporation|co|company|group|holdings?|partners|associates|institute|academy|university|college|district|hospital|clinic|health|healthcare|systems?|foundation|association|society|council|coalition|services|solutions|consulting|consultants|technologies|industries|international|enterprises?|capital|ventures|advisors|advisers|management)\.?$/i;

const HONORIFIC = /^(dr|mr|mrs|ms|miss|prof|professor|rev|sir|fr)\.?$/i;

const norm = (s?: string | null): string => (s || '').replace(/\s+/g, ' ').trim();
const key = (s?: string | null): string => norm(s).toLowerCase();

/** True when this string reads as an organization rather than a person. */
export function looksLikeOrganization(name?: string | null, company?: string | null): boolean {
  const n = norm(name);
  if (!n) return true;
  // The exact defect: the org name was typed into the contact field.
  if (company && key(n) === key(company)) return true;
  if (ORG_TAIL.test(n)) return true;
  return false;
}

/**
 * Greeting name from a full name, or null. Honorifics are skipped so
 * "Dr. Emily Chen" greets as "Emily". Returns null for anything empty —
 * callers must handle null rather than substituting a guess.
 */
export function firstNameOf(name?: string | null): string | null {
  const n = norm(name);
  if (!n) return null;
  const parts = n.split(' ').map(p => p.replace(/[,;]+$/, '')).filter(Boolean);
  if (parts.length === 0) return null;
  if (HONORIFIC.test(parts[0]) && parts.length > 1) return parts[1] || null;
  return parts[0] || null;
}

/**
 * Resolve the human behind ONE email address on a Client.
 *
 * @param client   the Client record
 * @param forEmail the address being written to (defaults to client.email)
 */
export function resolveClientContact(
  client: AnyRecord | null | undefined,
  forEmail?: string | null,
): ResolvedContact {
  const c: AnyRecord = client || {};
  const targetRaw = norm(forEmail) || norm(c.email);
  const target = key(targetRaw);
  const contacts: AnyRecord[] = Array.isArray(c.related_contacts) ? c.related_contacts : [];

  const unknown: ResolvedContact = {
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
  const owner = contacts.find(x => key(x?.email) === target);
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

/** Convenience: true when this Client has no usable human name on its primary address. */
export function isMissingContactName(client: AnyRecord | null | undefined): boolean {
  return resolveClientContact(client).confidence === 'none';
}

export interface ClientContactEntry {
  name: string;
  email: string;
  title: string;
  phone: string;
  is_primary: boolean;
  contact_type: string;
}

/**
 * Every human on file at this client, for context (e.g. an LLM prompt or a
 * contacts panel). Rows that are really the organization are dropped, so a
 * caller never sees "International Fund for Animal Welfare" presented as a person.
 */
export function listClientContacts(client: AnyRecord | null | undefined): ClientContactEntry[] {
  const c: AnyRecord = client || {};
  const contacts: AnyRecord[] = Array.isArray(c.related_contacts) ? c.related_contacts : [];
  const out: ClientContactEntry[] = [];
  const seen = new Set<string>();

  for (const x of contacts) {
    const name = norm(x?.name);
    const email = norm(x?.email);
    if (!name && !email) continue;
    if (looksLikeOrganization(name, c.company)) continue;
    const k = key(email) || key(name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      name,
      email,
      title: norm(x?.title),
      phone: norm(x?.phone),
      is_primary: !!x?.is_primary,
      contact_type: norm(x?.contact_type) || 'other',
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

/** The client's display identity — the organization, always. */
export function clientOrgName(client: AnyRecord | null | undefined): string {
  const c: AnyRecord = client || {};
  return norm(c.company) || norm(c.name) || '';
}

/**
 * Keep `related_contacts` in step with a patch to the mirrored top-level fields.
 *
 * The top-level name/email/title/phone are a MIRROR of the primary entry in
 * `related_contacts`. Several paths — the client's own portal profile editor,
 * the assessment funnel's return-visit update, inline edits on the client detail
 * view — wrote the top level only, so the two drifted apart and the next contact
 * edit silently reverted them. Pass the patch through this and write the returned
 * array alongside it.
 *
 * Returns the updated contact list; the caller still writes the top-level fields.
 */
export function syncPrimaryContact(
  client: AnyRecord | null | undefined,
  patch: AnyRecord = {},
): AnyRecord[] {
  const c: AnyRecord = client || {};
  const list: AnyRecord[] = Array.isArray(c.related_contacts)
    ? c.related_contacts.map((x: AnyRecord) => ({ ...x }))
    : [];

  const nextEmail = norm(patch.email ?? c.email);
  const nextName = norm(patch.name ?? c.name);
  const nextTitle = norm(patch.title ?? c.title);
  const nextPhone = norm(patch.phone ?? c.phone);
  const company = norm(patch.company ?? c.company);
  // Never let the organization land in a contact row.
  const person = nextName && !looksLikeOrganization(nextName, company) ? nextName : '';

  // The row being edited: the one on the OLD primary address (so a changed email
  // updates that person rather than orphaning them), else the new address, else
  // whatever is flagged primary.
  let idx = key(c.email) ? list.findIndex(x => key(x?.email) === key(c.email)) : -1;
  if (idx < 0 && key(nextEmail)) idx = list.findIndex(x => key(x?.email) === key(nextEmail));
  if (idx < 0) idx = list.findIndex(x => x?.is_primary);

  const row: AnyRecord = {
    contact_type: 'other',
    notes: '',
    ...(idx >= 0 ? list[idx] : {}),
    name: person,
    email: nextEmail,
    title: nextTitle,
    phone: nextPhone,
    is_primary: true,
  };

  if (idx >= 0) list[idx] = row;
  else list.unshift(row);
  const primaryAt = idx >= 0 ? idx : 0;

  return list.map((x, i) => ({ ...x, is_primary: i === primaryAt }));
}

export interface ClientIntake {
  company?: string | null;
  contactName?: string | null;
  email?: string | null;
  title?: string | null;
  phone?: string | null;
  notes?: string | null;
  contactType?: string | null;
}

/**
 * Build a well-formed Client payload from intake fields.
 *
 * USE THIS IN EVERY PATH THAT CREATES A CLIENT. It is the write-side counterpart
 * of resolveClientContact: the organization goes in `company`, the person goes
 * in `name`, and the person is ALSO seeded into `related_contacts` so the contact
 * list and the mirrored top-level fields agree from the first save. Creation
 * paths that skipped `related_contacts` are why adding a broker to a client could
 * overwrite that client's contact, and why so many records ended up holding the
 * organization in `name`.
 *
 * `contactName` may be empty — an unknown contact is a data gap to surface, not
 * something to fill in with the company name. `Client.name` is a required field,
 * so it falls back to the company; resolveClientContact reads name === company as
 * "no contact known" and the UI flags it for follow-up.
 *
 * KEEP IN SYNC with buildClientRecord in src/lib/clientContacts.js.
 */
export function buildClientRecord(intake: ClientIntake = {}): AnyRecord {
  const org = norm(intake.company);
  const person = norm(intake.contactName);
  const addr = norm(intake.email);
  const usablePerson = person && !looksLikeOrganization(person, org) ? person : '';

  const payload: AnyRecord = {
    company: org,
    name: usablePerson || org,
    email: addr,
    title: norm(intake.title),
    phone: norm(intake.phone),
  };

  const domain = getOrgDomain(addr);
  if (domain) payload.email_domain = domain;

  if (usablePerson || addr) {
    payload.related_contacts = [{
      name: usablePerson,
      email: addr,
      title: norm(intake.title),
      phone: norm(intake.phone),
      notes: norm(intake.notes),
      contact_type: norm(intake.contactType) || 'other',
      is_primary: true,
    }];
  }

  return payload;
}
