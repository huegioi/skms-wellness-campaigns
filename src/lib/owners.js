/**
 * Owner helpers — a record can have MORE THAN ONE owner.
 *
 * Storage: the existing `owner` string field on Lead / Client / ReferralPartner
 * (and the CampaignRecipient snapshot) holds a comma-separated list, e.g.
 * "William, Heather". Single-owner records are unchanged ("William"). The FIRST
 * name listed is the PRIMARY owner — Maya drafts and Gmail sends come from the
 * primary owner's mailbox when a campaign uses sender_mode = record_owner.
 *
 * Mirrored in base44/shared/owners.ts (Deno) — keep the two in sync.
 */

export const OWNER_NAMES = ['William', 'Heather'];

/** Filter value meaning "records with no owner" in page-level owner filters. */
export const UNASSIGNED_FILTER = '__unassigned__';

/** "William, Heather" → ['William', 'Heather']. Accepts an array too. */
export function parseOwners(owner) {
  const raw = Array.isArray(owner) ? owner : String(owner || '').split(/[,;/&+]|\band\b/i);
  const out = [];
  for (const part of raw) {
    const name = String(part || '').trim();
    if (!name) continue;
    if (out.some(o => o.toLowerCase() === name.toLowerCase())) continue;
    out.push(name);
  }
  return out;
}

/** ['William', 'Heather'] → "William, Heather". */
export function joinOwners(list) {
  return parseOwners(list).join(', ');
}

/** First listed owner, or '' when unassigned. */
export function primaryOwner(owner) {
  return parseOwners(owner)[0] || '';
}

/** Case-insensitive "is this person one of the owners?". */
export function hasOwner(owner, name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return false;
  return parseOwners(owner).some(o => o.toLowerCase() === n);
}

/** True when the record has no owner at all. */
export function isUnassigned(owner) {
  return parseOwners(owner).length === 0;
}

/**
 * Normalizes each owner to a bucket: 'heather' | 'william' | 'other'.
 * Returns ['unassigned'] when there is no owner. 'other' ensures a third name
 * never silently falls into William's bucket.
 */
export function ownerBuckets(owner) {
  const names = parseOwners(owner);
  if (names.length === 0) return ['unassigned'];
  const buckets = [];
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
export function senderForOwner(owner) {
  return primaryOwner(owner).toLowerCase().includes('heather') ? 'heather' : 'william';
}

/**
 * Campaign owner_filter → set of buckets. The stored value is either 'all' or a
 * comma-separated subset of 'william' | 'heather' | 'unassigned'
 * (e.g. "william,heather"). Legacy single values ('william') still parse.
 * An empty / 'all' / complete selection all mean "no owner filter".
 */
export const OWNER_FILTER_BUCKETS = ['william', 'heather', 'unassigned'];

export function parseOwnerFilter(ownerFilter) {
  const parts = String(ownerFilter || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0 || parts.includes('all')) return [];
  const set = OWNER_FILTER_BUCKETS.filter(b => parts.includes(b));
  return set.length === OWNER_FILTER_BUCKETS.length ? [] : set;
}

export function serializeOwnerFilter(buckets) {
  const set = OWNER_FILTER_BUCKETS.filter(b => (buckets || []).includes(b));
  return set.length === 0 || set.length === OWNER_FILTER_BUCKETS.length ? 'all' : set.join(',');
}

export function isOwnerFilterActive(ownerFilter) {
  return parseOwnerFilter(ownerFilter).length > 0;
}

/**
 * Does a record's owner string pass a campaign owner_filter?
 * A record passes when ANY of its owners is in the selected set; unassigned
 * records pass only when 'unassigned' is selected.
 */
export function matchesOwnerFilter(owner, ownerFilter) {
  const selected = parseOwnerFilter(ownerFilter);
  if (selected.length === 0) return true;
  return ownerBuckets(owner).some(b => selected.includes(b));
}

/**
 * Page-level owner filter (Leads / Clients dropdowns): value is 'all', a
 * display name ('William'), or UNASSIGNED_FILTER.
 */
export function matchesOwnerSelect(owner, selectValue) {
  if (!selectValue || selectValue === 'all') return true;
  if (selectValue === UNASSIGNED_FILTER) return isUnassigned(owner);
  return hasOwner(owner, selectValue);
}

/** Human label for a filter bucket. */
export function ownerBucketLabel(bucket) {
  if (bucket === 'william') return 'William';
  if (bucket === 'heather') return 'Heather';
  if (bucket === 'unassigned') return 'Unassigned';
  return bucket;
}
