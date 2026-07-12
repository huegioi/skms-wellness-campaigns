/**
 * Shared dashboard visual constants and formatters.
 * Import these instead of declaring local copies.
 */

// Unified chart palette: brand tokens first, then statusConfig chart hexes.
export const CHART_PALETTE = [
  '#264d44', // brand-green
  '#013f7c', // brand-navy
  '#770142', // brand-plum
  '#223d32', // brand-forest
  '#ff9878', // brand-peach
  '#422E33', // brand-bark
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#14b8a6', // teal
  '#f97316', // orange
  '#94a3b8', // slate
];

// Consistent chart height (h-64 = 256px)
export const CHART_HEIGHT = 256;

/** Format a number as USD with no decimals: $1,234 */
export function formatCurrency(value) {
  return `$${(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Format a 0-100 number as a percentage with 1 decimal: 45.3% */
export function formatPercent(value) {
  return `${(value || 0).toFixed(1)}%`;
}