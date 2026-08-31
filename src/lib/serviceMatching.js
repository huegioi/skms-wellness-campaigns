export const CATEGORY_LABELS = {
  workshop: 'Workshop',
  challenge: 'Challenge',
  leadership: 'Leadership',
  class: 'Class',
  wellness_box: 'Wellness Box',
};

export const CATEGORY_CHIP_LABELS = {
  workshop: 'Workshops',
  challenge: 'Challenges',
  leadership: 'Leadership',
  class: 'Classes',
  wellness_box: 'Boxes',
};

const DELIVERY_EVENT_TYPES = new Set(['workshop', 'challenge', 'class', 'leadership', 'presentation']);

export function isDeliveryEvent(event) {
  return DELIVERY_EVENT_TYPES.has(event.event_type);
}

export function eventCategory(event, serviceMap) {
  if (event.service_id && serviceMap[event.service_id]) {
    return serviceMap[event.service_id].category;
  }
  if (event.event_type === 'presentation') return 'workshop';
  if (DELIVERY_EVENT_TYPES.has(event.event_type)) return event.event_type;
  return null;
}

/**
 * Build a matcher that resolves an invoice line item to a canonical Service entity.
 * Priority: item.service_id → item.quickbooks_item_id → name match (case-insensitive, trimmed).
 */
export function buildServiceMatcher(services) {
  const byQbItemId = {};
  const byName = {};
  services.forEach(s => {
    if (s.quickbooks_item_id) byQbItemId[s.quickbooks_item_id] = s;
    if (s.name) byName[s.name.trim().toLowerCase()] = s;
  });
  return (lineItem) => {
    if (lineItem.service_id) {
      const match = services.find(s => s.id === lineItem.service_id);
      if (match) return match;
    }
    if (lineItem.quickbooks_item_id && byQbItemId[lineItem.quickbooks_item_id]) {
      return byQbItemId[lineItem.quickbooks_item_id];
    }
    const desc = (lineItem.description || '').trim().toLowerCase();
    if (desc && byName[desc]) return byName[desc];
    return null;
  };
}

/**
 * Turn a raw selection key into something presentable when no Service matches.
 * "navigating_holiday_stress" -> "Navigating Holiday Stress". Never show a slug.
 */
export function prettifyServiceKey(key) {
  const s = String(key || '').trim();
  if (!s) return 'Program';
  // A Base44 id (24 hex chars) has no human meaning — don't title-case it.
  if (/^[0-9a-f]{16,}$/i.test(s)) return 'Program';
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Resolve a proposal `selections` entry to a live Service.
 *
 * Selections normally hold Service IDs, but older and demo-seeded proposals
 * hold human slugs ("beyond_burnout"). Without a fallback the portal printed
 * the raw slug — no image, no description, no assessment badges. Priority:
 * exact id -> exact normalized name -> every slug token present in the name.
 */
export function buildSelectionResolver(services = []) {
  const byId = {};
  const byName = {};
  (services || []).forEach((s) => {
    if (s?.id) byId[s.id] = s;
    if (s?.name) byName[normName(s.name)] = s;
  });

  return (key) => {
    if (!key) return null;
    if (byId[key]) return byId[key];
    const n = normName(key);
    if (!n) return null;
    if (byName[n]) return byName[n];

    const tokens = n.split(' ').filter((t) => t.length > 2);
    if (tokens.length < 2) return null;

    let best = null;
    let bestExtra = Infinity;
    for (const s of services || []) {
      if (!s?.name) continue;
      const nameTokens = normName(s.name).split(' ').filter(Boolean);
      const nameSet = new Set(nameTokens);
      if (!tokens.every((t) => nameSet.has(t))) continue;
      const extra = nameTokens.length - tokens.length;
      if (extra < bestExtra) { best = s; bestExtra = extra; }
    }
    return best;
  };
}

export function categoryCountLabel(category, count) {
  switch (category) {
    case 'workshop':
    case 'class':
    case 'leadership':
      return `${count} session${count !== 1 ? 's' : ''}`;
    case 'challenge':
      return `${count} challenge${count !== 1 ? 's' : ''}`;
    case 'wellness_box':
      return `${count} box${count !== 1 ? 'es' : ''}`;
    default:
      return `${count} sold`;
  }
}