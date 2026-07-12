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