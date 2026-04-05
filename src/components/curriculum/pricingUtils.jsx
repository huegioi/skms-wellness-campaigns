// Shared pricing calculation utilities
import { productCatalog } from './catalogData';

export const calculateChallengePrice = (companySize) => {
  const employees = parseInt(companySize, 10);
  
  if (!employees || employees <= 0) {
    return 1500; // Default if no size entered
  }

  let pricePerParticipant = 25;
  if (employees >= 200) {
    pricePerParticipant = 20;
  } else if (employees >= 50) {
    pricePerParticipant = 22;
  }

  const participants = Math.ceil(employees * 0.30);
  return participants * pricePerParticipant;
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