// Shared pricing calculation utilities
import { calcPricing } from './ChallengePricingEstimator';

export const enumToApproxCount = (size) => ({
  '1-50': 25, '51-200': 125, '201-500': 350,
  '501-1000': 750, '1001-5000': 3000, '5000+': 5000,
}[size] || '');

export const calculateChallengePrice = (companySize) => {
  const employees = parseInt(companySize, 10);
  const result = calcPricing(employees);
  return result ? result.totalCost : 1500; // 1500 default when no headcount entered
};