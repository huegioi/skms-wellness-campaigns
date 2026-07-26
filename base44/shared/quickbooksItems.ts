// Category-level default QuickBooks Item mapping.
//
// When a Service has no quickbooks_item_id set, its invoice line routes
// to the Item defined here for that Service's category. Each entry picks
// the existing QB Item whose IncomeAccountRef is the correct income account
// for that category.
//
// Source: qbItemAudit inventory (49 items, audited 2026-07-26).
// Review this table before wiring it into the POST path.

export interface QBItemDefault {
  itemId: string;
  itemName: string;
  incomeAccount: string;
}

export const QB_CATEGORY_ITEM_DEFAULTS: Record<string, QBItemDefault> = {
  workshop: {
    itemId: '1010000021',
    itemName: 'Custom Workshop',
    incomeAccount: 'Corporate Workshops',
  },
  challenge: {
    itemId: '92',
    itemName: 'Emotional Resilience Challenge',
    incomeAccount: 'Challenges',
  },
  leadership: {
    itemId: '65',
    itemName: 'Leadership EQ (5hrs)',
    incomeAccount: 'Corporate Workshops',
  },
  // TODO: no dedicated Classes income account — confirm with bookkeeper.
  // Routed to "Sales" (the generic income account) until a dedicated
  // account is created or the bookkeeper confirms this is acceptable.
  class: {
    itemId: '1',
    itemName: 'Sales',
    incomeAccount: 'Sales',
  },
  wellness_box: {
    itemId: '94',
    itemName: 'Custom Wellness Box',
    incomeAccount: 'Wellness Boxes',
  },
};

// Generic Sales Item — used for custom charges that don't map to a Service.
export const QB_SALES_ITEM_ID = '1';