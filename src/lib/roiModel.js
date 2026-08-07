/**
 * Mental Fitness ROI Journey — frontend entry point.
 *
 * This is NOT a copy. The model lives in base44/shared/journeyModel.ts and is
 * imported by the Deno functions too, so the public Journey, the dashboard and
 * the Quick Builder can never disagree about a price again.
 *
 * All prices come from the rate card (base44/shared/rateCard.ts). Nothing in
 * this file, or in journeyModel.ts, may define a price of its own.
 */
export {
  STAGES,
  ROI_CAP_PER_DOLLAR,
  ROI_CAP_KNEE,
  partForSize,
  calcInvestment,
  runRoi,
  quickScoreFromAnswers,
} from '../../base44/shared/journeyModel.ts';

export { SCORE_ZONES, getZone } from '@/lib/mfsScore';
