/**
 * Bridges the static product catalog to the live Service entities.
 *
 * Why this exists: the assessment's suggestion maps (challengeSolutionMap,
 * workshopToChallengeMap) speak in static catalog keys ("beyondBurnout"),
 * but every selection step keys its cards by live Service IDs. Comparing one
 * to the other never matches, which silently broke "Recommended Based on
 * Your Assessment" — the banner showed, but no card was ever badged or
 * sorted first. This resolver matches static entries to live services BY
 * NAME, the same principle mfsServiceMapping already uses.
 *
 * Live names carry subtitles the static catalog lacks ("Steady Through the
 * Season: Navigating Holiday Stress & Winter Blues" vs "Steady Through the
 * Seasons"), so matching is tiered: exact → containment → token overlap with
 * light plural stemming. Best-scoring candidate wins; no match → dropped.
 */
import { productCatalog } from '@/components/curriculum/catalogData';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Tokens with trailing-s stripped, so "Seasons" matches "Season". */
const tokens = (s) =>
  new Set(
    norm(s)
      .split(' ')
      .filter(Boolean)
      .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
  );

/** 0 = no match. Higher is better. */
function matchScore(staticName, serviceName) {
  const a = norm(staticName);
  const b = norm(serviceName);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  const ta = tokens(staticName);
  const tb = tokens(serviceName);
  if (ta.size < 2 || tb.size < 2) return 0;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let hit = 0;
  for (const t of small) if (large.has(t)) hit++;
  // Every token of the shorter name must appear in the longer one.
  if (hit !== small.size) return 0;
  return 1 + hit / large.size; // prefer the tightest superset
}

/** productCatalog group for each Service category. */
const GROUP_BY_CATEGORY = {
  workshop: 'workshops',
  challenge: 'challenges',
  class: 'movementClasses',
  leadership: 'leadership',
};

function bestServiceFor(staticName, category, services) {
  let best = null;
  let bestScore = 0;
  for (const svc of services || []) {
    if (svc.category !== category || svc.is_active === false) continue;
    const score = matchScore(staticName, svc.name);
    if (score > bestScore) {
      best = svc;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Resolve static catalog keys to live Service IDs for one category.
 * Unmatched keys are dropped — a suggestion that cannot find its live
 * service should disappear, not crash or badge the wrong card.
 */
export function resolveStaticKeys(staticKeys, category, services) {
  const group = productCatalog[GROUP_BY_CATEGORY[category]] || {};
  const ids = [];
  for (const key of staticKeys || []) {
    const entry = group[key];
    if (!entry) continue;
    const svc = bestServiceFor(entry.name, category, services);
    if (svc && !ids.includes(svc.id)) ids.push(svc.id);
  }
  return ids;
}

/**
 * Reverse lookup: which static catalog key does a live Service correspond to?
 * Used to walk from a selected workshop (a Service ID) back into the static
 * workshop→challenge reinforcement map.
 */
export function staticKeyForService(serviceId, category, services) {
  const svc = (services || []).find((s) => s.id === serviceId);
  if (!svc) return null;
  const group = productCatalog[GROUP_BY_CATEGORY[category]] || {};
  let bestKey = null;
  let bestScore = 0;
  for (const [key, entry] of Object.entries(group)) {
    const score = matchScore(entry.name, svc.name);
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  }
  return bestKey;
}
