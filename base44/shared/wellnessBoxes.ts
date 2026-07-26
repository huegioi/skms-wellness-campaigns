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
  reduceStress: 60,
  relaxationSleep: 60,
  largeEmotional: 100,
  largeStressReduction: 120,
  stressReductionDigital: 50,
  beyondBurnoutDigital: 100,
  emotionalWellness: 100,
  wintertimeHealthy: 100,
  newYearFreshStart: 100,
};