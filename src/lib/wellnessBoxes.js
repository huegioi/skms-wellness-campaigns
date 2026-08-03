// Wellness box price constants — the nine keyed sample-box types.
//
// SOURCE OF TRUTH: the wellness_box Service records in the database
// (Service.category === 'wellness_box', matched by BOX_KEY_TO_SERVICE_NAME below).
//
// BACKEND MIRROR: base44/functions/recordReferralPurchase/entry.ts
// (FALLBACK_BOX_PRICES + BOX_KEY_TO_SERVICE_NAME).
//
// When a price changes, update the Service record first, then update
// the values here and in the backend file to match. All three must stay
// in sync. The backend already reads live Service prices at runtime and
// only falls back to these constants when a Service record is missing.
//
// Frontend sites that have a Services query in scope (ReviewStep,
// EditProposal) should read live Service prices via the BOX_KEY_TO_NAME
// map below, falling back to WELLNESS_BOX_PRICES when the query hasn't
// resolved yet. WellnessBoxStep (no Services query) imports
// WELLNESS_BOX_PRICES directly.

export const WELLNESS_BOX_PRICES = {
  reduceStress: 65,
  relaxationSleep: 65,
  largeEmotional: 100,
  largeStressReduction: 120,
  stressReductionDigital: 50,
  beyondBurnoutDigital: 100,
  emotionalWellness: 100,
  wintertimeHealthy: 100,
  newYearFreshStart: 100,
};

// Digital box keys — digital boxes have a lower price floor than physical ones.
export const DIGITAL_BOX_KEYS = ['stressReductionDigital', 'beyondBurnoutDigital'];
export const MIN_PHYSICAL_BOX_PRICE = 65;
export const MIN_DIGITAL_BOX_PRICE = 50;
export function isDigitalBox(key) { return DIGITAL_BOX_KEYS.includes(key); }
export function boxPriceFloor(key) {
  return isDigitalBox(key) ? MIN_DIGITAL_BOX_PRICE : MIN_PHYSICAL_BOX_PRICE;
}
export function applyBoxFloor(key, price) {
  return Math.max(Number(price) || 0, boxPriceFloor(key));
}

export function customBoxUnitPrice(items = []) {
  const sum = (items || []).reduce((s, i) => s + (Number(i?.price) || 0), 0);
  return Math.max(sum, MIN_PHYSICAL_BOX_PRICE);   // custom boxes are physical
}

// Maps box code keys to wellness_box Service record names for price lookup
export const BOX_KEY_TO_SERVICE_NAME = {
  reduceStress: 'Reduce Stress Wellness Box',
  relaxationSleep: 'Relaxation & Sleep Wellness Box',
  largeEmotional: 'Large Emotional Wellness Box',
  largeStressReduction: 'Large Stress Reduction Wellness Box',
  stressReductionDigital: 'Stress Reduction Digital Wellness Box',
  beyondBurnoutDigital: 'Beyond Burnout Digital Wellness Box',
  emotionalWellness: 'Emotional Wellness Box',
  wintertimeHealthy: 'Wintertime Stay Healthy Box',
  newYearFreshStart: 'New Year Fresh Start Box',
};

// Display labels for the nine keyed sample-box types — presentation only.
// Shared by ReviewStep (display array + PDF) and EditProposal (PDF).
// These are NOT Service record names; prices come from resolveBoxPrices,
// names come from here. Don't derive one from the other.
export const BOX_DISPLAY_NAMES = {
  reduceStress: 'Reduce Stress Box',
  relaxationSleep: 'Relaxation & Sleep Box',
  largeEmotional: 'Large Emotional Wellness Box',
  largeStressReduction: 'Large Stress Reduction Box',
  stressReductionDigital: 'Stress Reduction Digital Box',
  beyondBurnoutDigital: 'Beyond Burnout Digital Box',
  emotionalWellness: 'Emotional Wellness Box',
  wintertimeHealthy: 'Wintertime Stay Healthy Box',
  newYearFreshStart: 'New Year Fresh Start Box',
};

// Helper: build a key→price map from an array of Service records.
// Falls back to WELLNESS_BOX_PRICES for any key whose Service is missing
// or has no price. Returns { prices, fallbacksUsed } so callers can
// optionally log which keys fell back.
export function resolveBoxPrices(services = []) {
  const prices = {};
  const fallbacksUsed = [];
  for (const [key, name] of Object.entries(BOX_KEY_TO_SERVICE_NAME)) {
    const svc = services.find(s => s.category === 'wellness_box' && s.name === name);
    if (svc && typeof svc.price === 'number') {
      prices[key] = applyBoxFloor(key, svc.price);
    } else {
      prices[key] = applyBoxFloor(key, WELLNESS_BOX_PRICES[key] || 0);
      fallbacksUsed.push({ key, fallback_price: prices[key] });
    }
  }
  return { prices, fallbacksUsed };
}