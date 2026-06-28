// Shared pricing calculation utilities
import { productCatalog } from './catalogData';
import { calcPricing } from './ChallengePricingEstimator';

export const calculateChallengePrice = (companySize) => {
  const employees = parseInt(companySize, 10);
  const result = calcPricing(employees);
  return result ? result.totalCost : 1500; // 1500 default when no headcount entered
};

export const getItemPrice = (category, key, priceOverrides = {}, companySize = null) => {
  const overrideKey = `${category}_${key}`;
  
  // Check for price override first
  if (priceOverrides[overrideKey] !== undefined) {
    return priceOverrides[overrideKey];
  }
  
  // Use catalog prices or calculated challenge price
  if (category === 'workshops') {
    return productCatalog.workshops[key]?.price || 0;
  }
  
  if (category === 'challenges') {
    return companySize ? calculateChallengePrice(companySize) : 1500;
  }
  
  if (category === 'leadership') {
    return productCatalog.leadership[key]?.price || 0;
  }

  if (category === 'movementClasses') {
    return productCatalog.movementClasses[key]?.price || 0;
  }
  
  return 0;
};