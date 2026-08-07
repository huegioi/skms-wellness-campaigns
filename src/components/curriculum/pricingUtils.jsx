// Shared pricing helpers.
//
// These are thin wrappers over the rate card (base44/shared/rateCard.ts).
// They must not define prices or band→headcount mappings of their own.
import { resolveHeadcount, challengePrice } from '@/lib/rateCard';

/**
 * Representative headcount for a stored company_size value.
 *
 * Accepts either an exact number ("1250") or a legacy band ("201-500").
 * Delegates to the rate card so every screen resolves a band the same way —
 * this used to be a second, disagreeing map (it put "201-500" at 350 where
 * the rate card says 300, and "1001-5000" at 3000 against 2000).
 */
export const enumToApproxCount = (size) => resolveHeadcount(size) || '';

/**
 * Price of one 14-day challenge for a company.
 *
 * Returns null when headcount is unknown. It deliberately does NOT fall back
 * to a default: this function previously returned $1,500 for any company whose
 * headcount hadn't been entered, and that number reached emailed proposals.
 * Callers should surface "we need a headcount" rather than quote a guess.
 */
export const calculateChallengePrice = (companySize) => {
  const employees = resolveHeadcount(companySize);
  if (!employees) return null;
  return challengePrice(employees);
};
