/**
 * Applies the saved rate card overrides in the browser.
 *
 * Mounted once from Layout. Until it resolves the app shows the shipped
 * defaults; `ready` flips to true once the saved prices are in effect, so
 * screens that quote money can hold off rather than flashing a stale number.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { applyRateCardOverrides, resetRateCard } from '@/lib/rateCard';

let applied = false;          // module-level: only ever load once per page load
let inflight = null;

export async function ensureRateCardLoaded() {
  if (applied) return;
  if (!inflight) {
    inflight = (async () => {
      try {
        const records = await base44.entities.RateCardSetting.filter(
          { is_active: true }, '-updated_at', 1,
        );
        resetRateCard();
        if (records && records.length > 0) applyRateCardOverrides(records[0].overrides);
        applied = true;
      } catch (err) {
        // Not fatal — the shipped defaults are a correct rate card, just
        // possibly an out-of-date one. Never block the UI on this.
        console.error('[rateCard] could not load overrides, using defaults:', err);
        applied = true;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Forces a reload — call after saving on the Rate Card page. */
export function invalidateRateCard() {
  applied = false;
}

export function useRateCard() {
  const [ready, setReady] = useState(applied);
  useEffect(() => {
    let cancelled = false;
    ensureRateCardLoaded().then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  return ready;
}
