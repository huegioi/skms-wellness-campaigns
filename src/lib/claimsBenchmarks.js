/**
 * Frontend entry point to the claims benchmarks.
 *
 * This is NOT a copy — it re-exports base44/shared/claimsBenchmarks.ts, the
 * one and only definition of every Claims Insight constant. Vite compiles
 * the .ts and inlines it into the bundle; the Deno backend functions import
 * the exact same file. There is nothing to keep in sync.
 *
 * Import from here anywhere in src/:
 *   import { CLAIMS_BENCHMARKS } from '@/lib/claimsBenchmarks';
 *
 * If you are about to hard-code a benchmark, weight, band cutoff, or cost
 * constant somewhere in this app, stop and add it to
 * base44/shared/claimsBenchmarks.ts instead.
 */
export * from '../../base44/shared/claimsBenchmarks.ts';
