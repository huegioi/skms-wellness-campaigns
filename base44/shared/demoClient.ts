// ── Demo/internal client resolution (shared by survey/feedback stampers) ───
//
// Assessment/feedback rows generated from an internal client's events must be
// stamped is_demo: true so test survey runs never pollute admin analytics.
// Same for demo clients. This helper resolves the owning Client (by id) and
// returns true when the client is demo OR internal.

interface ClientLike {
  id: string;
  is_demo?: boolean;
  is_internal?: boolean;
}

const _cache = new Map<string, { isDemo: boolean; at: number }>();
const TTL = 60_000; // 1 minute — keeps repeated stampers cheap within one request batch

/**
 * Returns true when the client identified by `clientId` is demo or internal.
 * Cached for 60s to avoid repeat lookups within a single submission batch.
 */
export async function clientIsDemoOrInternal(
  base44: any,
  clientId: string | null | undefined
): Promise<boolean> {
  if (!clientId) return false;
  const now = Date.now();
  const hit = _cache.get(clientId);
  if (hit && (now - hit.at) < TTL) return hit.isDemo;
  let isDemo = false;
  try {
    const rows = await base44.asServiceRole.entities.Client.filter({ id: clientId });
    const c: ClientLike | undefined = rows?.[0];
    isDemo = !!(c && (c.is_demo === true || c.is_internal === true));
  } catch {
    isDemo = false;
  }
  _cache.set(clientId, { isDemo, at: now });
  return isDemo;
}

/**
 * Returns true when the ReferralPartner identified by `partnerId` is internal.
 * (Internal brokers' referral records are stamped is_demo.)
 */
export async function partnerIsInternal(
  base44: any,
  partnerId: string | null | undefined
): Promise<boolean> {
  if (!partnerId) return false;
  try {
    const rows = await base44.asServiceRole.entities.ReferralPartner.filter({ id: partnerId });
    return !!(rows?.[0]?.is_internal === true);
  } catch {
    return false;
  }
}