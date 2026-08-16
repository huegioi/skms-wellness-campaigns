/**
 * Loads the saved claims-benchmark overrides and applies them.
 *
 * Call this at the start of any BACKEND function that scores a claims
 * profile, before you compute anything:
 *
 *   import { loadClaimsBenchmarks } from '../../shared/loadClaimsBenchmarks.ts';
 *   await loadClaimsBenchmarks(base44);
 *
 * Deno functions are short-lived, so the module-level benchmarks start at
 * the shipped defaults on every cold start. Without this call a function
 * would score with the defaults while the admin tab showed saved values —
 * the exact silent disagreement the rate card refactor removed.
 *
 * Failing to load is deliberately NOT fatal: scoring with the shipped
 * defaults is far better than erroring out mid-analysis. It logs loudly.
 */
import { applyClaimsBenchmarkOverrides, resetClaimsBenchmarks } from './claimsBenchmarks.ts';

export async function loadClaimsBenchmarks(base44: any): Promise<string[]> {
  try {
    const records = await base44.asServiceRole.entities.ClaimsBenchmarkSetting.filter(
      { is_active: true }, '-updated_at', 1,
    );
    // Always start from defaults so a warm container can't accumulate stale
    // overrides from a previous version of the record.
    resetClaimsBenchmarks();
    if (!records || records.length === 0) return [];
    return applyClaimsBenchmarkOverrides(records[0].overrides);
  } catch (err) {
    console.error('[claimsBenchmarks] could not load overrides, using shipped defaults:', (err as any)?.message || err);
    return [];
  }
}
