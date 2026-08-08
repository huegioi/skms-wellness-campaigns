/**
 * Public rate card feed.
 *
 * The Railway ROI calculator (github.com/huegioi/skillfulmeans-roi) reads this
 * so it quotes the same prices as everything else. Before this existed it had
 * its own copy of a long-dead pricing model — $250 per leader against the rate
 * card's $1,250, a flat $1,500 a session, 150-seat caps — and was showing
 * prospects roughly 40% of the real Stage 1 price.
 *
 * Because it returns the LIVE rate card (shipped defaults + whatever is saved
 * on the Rate Card admin page), editing a price in the app changes the ROI
 * calculator too, with no redeploy of either side.
 *
 *   GET /functions/getPublicRateCard?headcount=1250
 *
 * Returns the rates, the tier definitions, and a fully computed quote for each
 * of the six stages at that headcount — so the caller does not have to
 * reimplement any pricing logic. That is the point: one engine, not two.
 *
 * Public and CORS-open on purpose. It exposes list prices, which are already
 * shown to any prospect who opens the Quick Builder.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { loadRateCard } from '../../shared/loadRateCard.ts';
import {
  RATE_CARD,
  CHALLENGE_TIERS,
  CAMPAIGN_STAGES,
  WELLNESS_BOX_PRICES,
  CLASS_PRICES,
  computeQuote,
  sessionsPerWorkshop,
  challengeSlots,
} from '../../shared/rateCard.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  // Short cache: a price edit should reach the calculator quickly, but we
  // don't want every keystroke on a slider hitting the database.
  'Cache-Control': 'public, max-age=60',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const base44 = createClientFromRequest(req);
    await loadRateCard(base44);   // saved overrides, so this reflects the admin page

    const url = new URL(req.url);
    const headcount = Math.max(0, parseInt(url.searchParams.get('headcount') || '0', 10) || 0);

    const quotes: Record<string, unknown> = {};
    if (headcount > 0) {
      for (const stage of CAMPAIGN_STAGES) {
        const q = computeQuote({ headcount, stage: stage.stage });
        quotes[String(stage.stage)] = {
          total: q.total,
          subtotal: q.subtotal,
          lines: q.lines.map(l => ({ key: l.key, label: l.label, detail: l.detail, amount: l.amount })),
          meta: q.meta,
        };
      }
    }

    return new Response(JSON.stringify({
      // Bump when the SHAPE changes, so a stale caller can notice.
      schema: 1,
      generated_at: new Date().toISOString(),
      headcount,
      rates: RATE_CARD,
      challengeTiers: CHALLENGE_TIERS.map(t => ({
        min: t.min,
        max: t.max === Infinity ? null : t.max,
        price: t.price,
      })),
      wellnessBoxPrices: WELLNESS_BOX_PRICES,
      classPrices: CLASS_PRICES,
      stages: CAMPAIGN_STAGES.map(s => ({
        stage: s.stage,
        name: s.name,
        tagline: s.tagline,
        intent: s.intent,
        workshops: s.workshops,
        challenges: s.challenges,
        leadershipEQ: s.leadershipEQ,
        groupCoaching: s.groupCoaching,
        individualCoaching: s.individualCoaching,
      })),
      derived: headcount > 0 ? {
        sectionsPerWorkshop: sessionsPerWorkshop(headcount),
        challengeSlots: challengeSlots(headcount),
      } : null,
      quotes,
    }), { status: 200, headers: CORS });
  } catch (err) {
    console.error('[getPublicRateCard]', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'rate card unavailable' }),
      { status: 500, headers: CORS },
    );
  }
});
