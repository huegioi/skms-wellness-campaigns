/**
 * Owner helpers — a record can have MORE THAN ONE owner.
 *
 * Storage: the existing `owner` string field on Lead / Client / ReferralPartner
 * (and the CampaignRecipient snapshot) holds a comma-separated list, e.g.
 * "William, Heather". Single-owner records are unchanged ("William"). The FIRST
 * name listed is the PRIMARY owner — Maya drafts and Gmail sends come from the
 * primary owner's mailbox when a campaign uses sender_mode = record_owner.
 *
 * Mirror of src/lib/owners.js — keep the two in sync.
 */

export const OWNER_NAMES = ['William', 'Heather'];

/** "William, Heather" → ['William', 'Heather']. Accepts an array too. */
export function parseOwners(owner: unknown): string[] {
  const raw: unknown[] = Array.isArray(owner) ? owner : String(owner || '').split(/[,;/&+]|\band\b/i);
  const out: string[] = [];
  for (const part of raw) {
    const name = String(part || '').trim();
    if (!name) continue;
    if (out.some(o => o.toLowerCase() === name.toLowerCase())) continue;
    out.push(name);
  }
  return out;
}

/** ['William', 'Heather'] → "William, Heather". */
export function joinOwners(list: unknown): string {
  return parseOwners(list).join(', ');
}

/** First listed owner, or '' when unassigned. */
export function primaryOwner(owner: unknown): string {
  return parseOwners(owner)[0] || '';
}

/** Case-insensitive "is this person one of the owners?". */
export function hasOwner(owner: unknown, name: string): boolean {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return false;
  return parseOwners(owner).some(o => o.toLowerCase() === n);
}

/** True when the record has no owner at all. */
export function isUnassigned(owner: unknown): boolean {
  return parseOwners(owner).length === 0;
}

/**
 * Normalizes each owner to a bucket: 'heather' | 'william' | 'other'.
 * Returns ['unassigned'] when there is no owner.
 */
export function ownerBuckets(owner: unknown): string[] {
  const names = parseOwners(owner);
  if (names.length === 0) return ['unassigned'];
  const buckets: string[] = [];
  for (const name of names) {
    const o = name.toLowerCase();
    const b = o.includes('heather') ? 'heather' : o.includes('william') ? 'william' : 'other';
    if (!buckets.includes(b)) buckets.push(b);
  }
  return buckets;
}

/**
 * Mailbox that sends on behalf of this record when sender_mode = record_owner.
 * Decided by the PRIMARY (first-listed) owner; anything that is not Heather
 * (including unassigned) goes out from William.
 */
export function senderForOwner(owner: unknown): 'heather' | 'william' {
  return primaryOwner(owner).toLowerCase().includes('heather') ? 'heather' : 'william';
}

/**
 * Campaign owner_filter → set of buckets. The stored value is either 'all' or a
 * comma-separated subset of 'william' | 'heather' | 'unassigned'
 * (e.g. "william,heather"). Legacy single values ('william') still parse.
 */
export const OWNER_FILTER_BUCKETS = ['william', 'heather', 'unassigned'];

export function parseOwnerFilter(ownerFilter: unknown): string[] {
  const parts = String(ownerFilter || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0 || parts.includes('all')) return [];
  const set = OWNER_FILTER_BUCKETS.filter(b => parts.includes(b));
  return set.length === OWNER_FILTER_BUCKETS.length ? [] : set;
}

export function serializeOwnerFilter(buckets: string[]): string {
  const set = OWNER_FILTER_BUCKETS.filter(b => (buckets || []).includes(b));
  return set.length === 0 || set.length === OWNER_FILTER_BUCKETS.length ? 'all' : set.join(',');
}

export function isOwnerFilterActive(ownerFilter: unknown): boolean {
  return parseOwnerFilter(ownerFilter).length > 0;
}

/**
 * Does a record's owner string pass a campaign owner_filter?
 * A record passes when ANY of its owners is in the selected set; unassigned
 * records pass only when 'unassigned' is selected.
 */
export function matchesOwnerFilter(owner: unknown, ownerFilter: unknown): boolean {
  const selected = parseOwnerFilter(ownerFilter);
  if (selected.length === 0) return true;
  return ownerBuckets(owner).some(b => selected.includes(b));
}
