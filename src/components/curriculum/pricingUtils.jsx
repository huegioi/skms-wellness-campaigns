// Shared pricing calculation utilities
import { calcPricing } from './ChallengePricingEstimator';

export const calculateChallengePrice = (companySize) => {
  const employees = parseInt(companySize, 10);
  const result = calcPricing(employees);
  return result ? result.totalCost : 1500; // 1500 default when no headcount entered
};