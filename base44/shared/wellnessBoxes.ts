// Backend mirror of src/lib/wellnessBoxes.js.
// Shared by backend functions that need box display names, price lookups,
// or key→Service-name mapping. Keep in sync with the frontend file.

export const BOX_KEY_TO_SERVICE_NAME: Record<string, string> = {
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

export const BOX_DISPLAY_NAMES: Record<string, string> = {
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

export const WELLNESS_BOX_FALLBACK_PRICES: Record<string, number> = {
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
export function isDigitalBox(key: string): boolean { return DIGITAL_BOX_KEYS.includes(key); }
export function boxPriceFloor(key: string): number {
  return isDigitalBox(key) ? MIN_DIGITAL_BOX_PRICE : MIN_PHYSICAL_BOX_PRICE;
}
export function applyBoxFloor(key: string, price: number | undefined | null): number {
  return Math.max(Number(price) || 0, boxPriceFloor(key));
}