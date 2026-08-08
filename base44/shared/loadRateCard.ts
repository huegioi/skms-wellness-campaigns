/**
 * Loads the saved rate card overrides and applies them.
 *
 * Call this at the start of any BACKEND function that prices something, before
 * you compute anything:
 *
 *   import { loadRateCard } from '../../shared/loadRateCard.ts';
 *   await loadRateCard(base44);
 *
 * Deno functions are short-lived, so the module-level rate card starts at the
 * shipped defaults on every cold start. Without this call a function would
 * quote the defaults while the rest of the app used the saved prices — the
 * exact class of silent disagreement this whole refactor removed.
 *
 * Failing to load is deliberately NOT fatal: quoting the shipped defaults is
 * far better than erroring out mid-proposal. It logs loudly instead.
 */
import { applyRateCardOverrides, resetRateCard } from './rateCard.ts';

export async function loadRateCard(base44: any): Promise<string[]> {
  try {
    const records = await base44.asServiceRole.entities.RateCardSetting.filter(
      { is_active: true }, '-updated_at', 1,
    );
    // Always start from defaults so a warm container can't accumulate stale
    // overrides from a previous version of the record.
    resetRateCard();
    if (!records || records.length === 0) return [];
    return applyRateCardOverrides(records[0].overrides);
  } catch (err) {
    console.error('[rateCard] could not load overrides, using shipped defaults:', err?.message || err);
    return [];
  }
}
