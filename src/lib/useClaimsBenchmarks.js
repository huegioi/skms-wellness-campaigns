/**
 * Applies the saved claims-benchmark overrides in the browser.
 *
 * Mounted from the Claims Insight page. Until it resolves the engine scores
 * with the shipped defaults; `ready` flips to true once the saved values are
 * in effect, so the wizard's live preview never flashes a stale score.
 * Same pattern as useRateCard.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { applyClaimsBenchmarkOverrides, resetClaimsBenchmarks } from '@/lib/claimsBenchmarks';

let applied = false;          // module-level: only ever load once per page load
let inflight = null;

export async function ensureClaimsBenchmarksLoaded() {
  if (applied) return;
  if (!inflight) {
    inflight = (async () => {
      try {
        const records = await base44.entities.ClaimsBenchmarkSetting.filter(
          { is_active: true }, '-updated_at', 1,
        );
        resetClaimsBenchmarks();
        if (records && records.length > 0) applyClaimsBenchmarkOverrides(records[0].overrides);
        applied = true;
      } catch (err) {
        // Not fatal — the shipped defaults are a correct benchmark set, just
        // possibly an uncalibrated one. Never block the UI on this.
        console.error('[claimsBenchmarks] could not load overrides, using defaults:', err);
        applied = true;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Forces a reload — call after saving on the Benchmarks tab. */
export function invalidateClaimsBenchmarks() {
  applied = false;
}

export function useClaimsBenchmarks() {
  const [ready, setReady] = useState(applied);
  useEffect(() => {
    let cancelled = false;
    ensureClaimsBenchmarksLoaded().then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  return ready;
}
