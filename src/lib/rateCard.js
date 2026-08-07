/**
 * Frontend entry point to the rate card.
 *
 * This is NOT a copy — it re-exports base44/shared/rateCard.ts, which is the
 * one and only definition of every SkillfulMeans price. Vite compiles the .ts
 * and inlines it into the bundle; the Deno backend functions import the exact
 * same file. There is nothing to keep in sync.
 *
 * Import from here anywhere in src/:
 *   import { computeQuote, RATE_CARD } from '@/lib/rateCard';
 *
 * If you are about to hard-code a dollar amount somewhere in this app, stop
 * and add it to base44/shared/rateCard.ts instead.
 */
export * from '../../base44/shared/rateCard.ts';
