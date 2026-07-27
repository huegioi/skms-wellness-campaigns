/**
 * Stable SHA-256 fingerprint of a QuickBooks invoice body.
 *
 * Ensures the body displayed on the review screen is the exact body POSTed
 * to QuickBooks — no rebuild from proposal_id, no silent mutation between
 * review and send.
 *
 * The body is canonicalized (keys sorted at all levels) before hashing,
 * so key insertion order doesn't affect the fingerprint.
 */

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

export async function computeFingerprint(body) {
  const serialized = JSON.stringify(canonicalize(body));
  const data = new TextEncoder().encode(serialized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}