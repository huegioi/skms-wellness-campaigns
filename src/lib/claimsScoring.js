/**
 * Frontend entry point to the Claims Insight scoring engine.
 *
 * Re-exports base44/shared/claimsScoring.ts — the pure engine the Deno
 * backend uses too. See that file for the blank-semantics contract and the
 * worksheet acceptance test (verifyClaimsScoring).
 *
 *   import { scoreClaimsProfile, recommendClaimsCampaign } from '@/lib/claimsScoring';
 */
export * from '../../base44/shared/claimsScoring.ts';
