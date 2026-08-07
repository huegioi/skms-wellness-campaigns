// Wellness box helpers.
//
// The nine box prices, their Service record names and their display labels all
// live in the rate card (base44/shared/rateCard.ts) — the same file the Deno
// backend imports. This module only re-exports them and adds the lookup
// helpers that need a Services query.
//
// Live Service records still win when present: resolveBoxPrices() prefers a
// wellness_box Service's price and falls back to the rate card. That is
// deliberate — box SKU prices are flat, so a stored number CAN be right for
// them, unlike workshops or challenges which depend on headcount.

export {
  WELLNESS_BOX_PRICES,
  BOX_KEY_TO_SERVICE_NAME,
  BOX_DISPLAY_NAMES,
  DIGITAL_BOX_KEYS,
  MIN_PHYSICAL_BOX_PRICE,
  MIN_DIGITAL_BOX_PRICE,
  applyBoxFloor,
} from '../../base44/shared/rateCard.ts';

import {
  WELLNESS_BOX_PRICES,
  BOX_KEY_TO_SERVICE_NAME,
  DIGITAL_BOX_KEYS,
  MIN_PHYSICAL_BOX_PRICE,
  MIN_DIGITAL_BOX_PRICE,
  applyBoxFloor,
} from '../../base44/shared/rateCard.ts';

export function isDigitalBox(key) { return DIGITAL_BOX_KEYS.includes(key); }

export function boxPriceFloor(key) {
  return isDigitalBox(key) ? MIN_DIGITAL_BOX_PRICE : MIN_PHYSICAL_BOX_PRICE;
}

export function customBoxUnitPrice(items = []) {
  const sum = (items || []).reduce((s, i) => s + (Number(i?.price) || 0), 0);
  return Math.max(sum, MIN_PHYSICAL_BOX_PRICE);   // custom boxes are physical
}

/**
 * key → price map built from live Service records, falling back to the rate
 * card for any box whose Service record is missing or has no price.
 * Returns { prices, fallbacksUsed } so callers can log which keys fell back.
 *
 * Always covers all nine keys — a partial map is how five box types ended up
 * priced at $0 in emailed proposals.
 */
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
