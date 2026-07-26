// Single source of truth for QuickBooks invoice body assembly.
//
// Both the dry-run (qbInvoiceBuild) and the POST (createQBInvoice in
// quickbooksSync) call buildInvoiceBody with a normalised line list
// produced by one of two adapters:
//   - linesFromProposal: snapshot-first pricing from Proposal.selections
//   - linesFromInvoice:  from Invoice.line_items, matching by description
//
// The builder owns Item resolution (Service.quickbooks_item_id → category
// default → blocking error) and returns blocking errors rather than
// emitting a null ItemRef.
//
// The body it produces is always UNSENT: no EmailStatus, no DeliveryInfo,
// no SalesTermRef, no DueDate, no TxnTaxDetail. BillEmail populates the
// recipient field for manual dispatch — it does not trigger delivery.

import { QB_CATEGORY_ITEM_DEFAULTS, QB_SALES_ITEM_ID } from './quickbooksItems.ts';
import { BOX_DISPLAY_NAMES, BOX_KEY_TO_SERVICE_NAME, WELLNESS_BOX_FALLBACK_PRICES } from './wellnessBoxes.ts';

// ── Types ────────────────────────────────────────────────────────────

export interface NormalizedLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  // Item resolution — at least one must be provided:
  serviceId?: string;           // looks up Service.quickbooks_item_id → category default
  quickbooks_item_id?: string;  // explicit ItemRef (bypasses serviceId)
  category?: string;            // fallback when serviceId is unknown or has no item
  serviceName?: string;         // for error reporting / analysis
  lineType?: string;            // for analysis (workshop, challenge, wellness_box, etc.)
  priceSource?: string;         // for analysis (price_override, proposal_snapshot, etc.)
}

export interface InvoiceBodyOptions {
  customerId: string;
  customerEmail: string;
  txnDate: string;
  lines: NormalizedLine[];
  memo?: string;
  docNumber?: string;
  serviceMap?: Map<string, any>;
}

export interface InvoiceBodyResult {
  body: any;
  lineAnalysis: any[];
  blockingErrors: any[];
  warnings: string[];
}

// ── Builder ──────────────────────────────────────────────────────────

export function buildInvoiceBody(opts: InvoiceBodyOptions): InvoiceBodyResult {
  const { customerId, customerEmail, txnDate, lines, memo, docNumber, serviceMap } = opts;
  const resolvedLines: any[] = [];
  const lineAnalysis: any[] = [];
  const blockingErrors: any[] = [];
  const warnings: string[] = [];

  for (const line of lines) {
    // ── Item resolution ──
    let itemRef: { value: string; source: string; itemName: string | null } | null = null;

    // 1. Explicit quickbooks_item_id on the line
    if (line.quickbooks_item_id) {
      itemRef = { value: line.quickbooks_item_id, source: 'line_item_override', itemName: null };
    }
    // 2. Service lookup (serviceId → Service.quickbooks_item_id → Service.category default)
    else if (line.serviceId && serviceMap) {
      const svc = serviceMap.get(line.serviceId);
      if (svc?.quickbooks_item_id) {
        itemRef = { value: svc.quickbooks_item_id, source: 'service_level', itemName: svc.qb_item_name || svc.name };
      } else if (svc?.category && QB_CATEGORY_ITEM_DEFAULTS[svc.category]) {
        const def = QB_CATEGORY_ITEM_DEFAULTS[svc.category];
        itemRef = { value: def.itemId, source: 'category_default', itemName: def.itemName };
      }
    }

    // 3. Category fallback (when no serviceId, or serviceId not in map, or Service has no item)
    if (!itemRef && line.category && QB_CATEGORY_ITEM_DEFAULTS[line.category]) {
      const def = QB_CATEGORY_ITEM_DEFAULTS[line.category];
      itemRef = { value: def.itemId, source: 'category_default', itemName: def.itemName };
    }

    if (!itemRef || !itemRef.value) {
      blockingErrors.push({
        type: line.lineType || 'unknown',
        service_id: line.serviceId,
        name: line.serviceName || line.description,
        category: line.category,
        reason: 'No QuickBooks Item — no quickbooks_item_id, no Service match, and no category default',
      });
      continue;
    }

    const amount = line.amount || (line.quantity * line.unitPrice);

    resolvedLines.push({
      DetailType: 'SalesItemLineDetail',
      Amount: amount,
      Description: line.description,
      SalesItemLineDetail: {
        ItemRef: { value: itemRef.value },
        Qty: line.quantity,
        UnitPrice: line.unitPrice,
      },
    });

    lineAnalysis.push({
      type: line.lineType || 'line',
      service_id: line.serviceId,
      name: line.serviceName || line.description,
      item_source: itemRef.source,
      item_name: itemRef.itemName,
      price_source: line.priceSource || 'unknown',
      price: line.unitPrice,
      qty: line.quantity,
      amount,
    });
  }

  // ── Assemble body ──
  const body: any = {
    CustomerRef: { value: customerId },
    TxnDate: txnDate,
    BillEmail: { Address: customerEmail },
    Line: resolvedLines,
  };

  if (memo) {
    body.CustomerMemo = { value: memo };
  }

  if (docNumber) {
    body.DocNumber = docNumber;
  }

  // No EmailStatus, no DeliveryInfo, no SalesTermRef, no DueDate, no TxnTaxDetail.

  return { body, lineAnalysis, blockingErrors, warnings };
}

// ── Proposal adapter ─────────────────────────────────────────────────

export function linesFromProposal(
  selections: any,
  serviceMap: Map<string, any>,
  allServices: any[]
): { lines: NormalizedLine[]; warnings: string[] } {
  const s = selections || {};
  const overrides = s.priceOverrides || {};
  const lines: NormalizedLine[] = [];
  const warnings: string[] = [];

  // Helper: resolve price for a non-box Service, snapshot-first
  function resolveServicePrice(serviceId: string, dataKey: string) {
    if (overrides[serviceId] !== undefined) {
      return { price: overrides[serviceId], source: 'price_override' };
    }
    const dataArr = s[dataKey] || [];
    const dataEntry = dataArr.find((x: any) => x.id === serviceId);
    if (dataEntry && dataEntry.price > 0) {
      return { price: dataEntry.price, source: 'proposal_snapshot' };
    }
    const svc = serviceMap.get(serviceId);
    if (svc && svc.price > 0) {
      warnings.push(`Line for "${svc.name}" (${serviceId}) used live Service price ($${svc.price}) — no proposal snapshot found.`);
      return { price: svc.price, source: 'live_service_price' };
    }
    warnings.push(`Line for service ${serviceId} has no price from any source — defaulted to $0.`);
    return { price: 0, source: 'fallback_zero' };
  }

  // ── Workshops ──
  for (const id of (s.workshops || [])) {
    const { price, source } = resolveServicePrice(id, 'workshopsData');
    const svc = serviceMap.get(id);
    lines.push({
      description: svc?.name || 'Workshop',
      quantity: 1,
      unitPrice: price,
      amount: price,
      serviceId: id,
      serviceName: svc?.name,
      lineType: 'workshop',
      priceSource: source,
    });
  }

  // ── Challenge programs ──
  const challengePrice = s.challengePrice || 0;
  for (const id of (s.challengePrograms || [])) {
    let price: number, source: string;
    if (overrides[id] !== undefined) {
      price = overrides[id]; source = 'price_override';
    } else if (challengePrice > 0) {
      price = challengePrice; source = 'challenge_price_field';
    } else {
      const result = resolveServicePrice(id, 'challengeProgramsData');
      price = result.price; source = result.source;
    }
    const svc = serviceMap.get(id);
    // challengePrice is a flat per-challenge amount, not a per-head rate.
    const qty = 1;
    lines.push({
      description: svc?.name || 'Challenge',
      quantity: qty,
      unitPrice: price,
      amount: price * qty,
      serviceId: id,
      serviceName: svc?.name,
      lineType: 'challenge',
      priceSource: source,
    });
  }

  // ── Leadership ──
  for (const id of (s.leadership || [])) {
    const { price, source } = resolveServicePrice(id, 'leadershipData');
    const svc = serviceMap.get(id);
    lines.push({
      description: svc?.name || 'Leadership',
      quantity: 1,
      unitPrice: price,
      amount: price,
      serviceId: id,
      serviceName: svc?.name,
      lineType: 'leadership',
      priceSource: source,
    });
  }

  // ── Movement classes ──
  for (const id of (s.movementClasses || [])) {
    const { price, source } = resolveServicePrice(id, 'movementClassesData');
    const svc = serviceMap.get(id);
    // No session-count field exists in any proposal — classes are priced per session.
    const qty = 1;
    lines.push({
      description: svc?.name || 'Class',
      quantity: qty,
      unitPrice: price,
      amount: price * qty,
      serviceId: id,
      serviceName: svc?.name,
      lineType: 'class',
      priceSource: source,
    });
  }

  // ── Wellness boxes ──
  const boxQtys = s.sampleBoxQuantities || {};
  const boxSnapshot = s.sampleBoxPrices || {};
  for (const [key, qty] of Object.entries(boxQtys)) {
    if (!qty) continue;
    const boxSvcName = BOX_KEY_TO_SERVICE_NAME[key];
    const boxSvc = allServices.find(svc => svc.category === 'wellness_box' && svc.name === boxSvcName);
    let price: number, source: string;
    if (boxSnapshot[key] != null) {
      price = boxSnapshot[key]; source = 'sample_box_prices';
    } else if (boxSvc && boxSvc.price > 0) {
      warnings.push(`Box "${BOX_DISPLAY_NAMES[key] || key}" used live Service price ($${boxSvc.price}) — no snapshot found.`);
      price = boxSvc.price; source = 'live_service_price';
    } else {
      price = WELLNESS_BOX_FALLBACK_PRICES[key] || 0;
      source = 'fallback_constant';
      warnings.push(`Box "${BOX_DISPLAY_NAMES[key] || key}" used fallback constant ($${price}) — no Service record or snapshot.`);
    }
    const displayName = BOX_DISPLAY_NAMES[key] || key;
    lines.push({
      description: displayName,
      quantity: qty as number,
      unitPrice: price,
      amount: price * (qty as number),
      serviceId: boxSvc?.id,
      category: 'wellness_box',
      serviceName: displayName,
      lineType: 'wellness_box',
      priceSource: source,
    });
  }

  // ── Custom wellness box ──
  const customBoxQty = s.customBoxQuantity || 0;
  const customBoxItems = s.customBoxItems || [];
  if (customBoxQty > 0 && customBoxItems.length > 0) {
    const unitPrice = customBoxItems.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
    lines.push({
      description: 'Custom Wellness Box',
      quantity: customBoxQty,
      unitPrice,
      amount: unitPrice * customBoxQty,
      category: 'wellness_box',
      serviceName: 'Custom Wellness Box',
      lineType: 'custom_wellness_box',
      priceSource: 'custom_box_items',
    });
  }

  // ── Custom charges ──
  for (const charge of (s.customCharges || [])) {
    const amount = charge.amount || 0;
    const label = charge.label || charge.description || 'Custom Charge';
    lines.push({
      description: label,
      quantity: 1,
      unitPrice: amount,
      amount,
      quickbooks_item_id: QB_SALES_ITEM_ID,
      serviceName: label,
      lineType: 'custom_charge',
      priceSource: 'custom_charge',
    });
  }

  return { lines, warnings };
}

// ── Invoice adapter ──────────────────────────────────────────────────

export function linesFromInvoice(
  lineItems: any[],
  allServices: any[]
): { lines: NormalizedLine[]; warnings: string[] } {
  const lines: NormalizedLine[] = [];
  const warnings: string[] = [];

  for (const item of (lineItems || [])) {
    const description = item.description || item.name || 'Service';
    const quantity = item.quantity || 1;
    const unitPrice = item.rate || 0;
    const amount = item.amount || (quantity * unitPrice);

    // Try to match by description to a Service for Item resolution.
    // 1. Exact name match
    // 2. Substring match (Service name contained in description)
    let serviceId: string | undefined;
    let serviceName: string | undefined;
    let category: string | undefined;

    if (!item.quickbooks_item_id) {
      const descLower = description.toLowerCase();
      // Exact match first
      let matched = allServices.find(svc => svc.name && svc.name.toLowerCase() === descLower);
      // Substring match: longest matching Service name wins (most specific)
      if (!matched) {
        const candidates = allServices.filter(svc =>
          svc.name && descLower.includes(svc.name.toLowerCase())
        );
        if (candidates.length > 0) {
          matched = candidates.sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))[0];
        }
      }
      if (matched) {
        serviceId = matched.id;
        serviceName = matched.name;
        category = matched.category;
      } else {
        warnings.push(`Invoice line "${description}" did not match any Service — Item will need manual resolution.`);
      }
    }

    lines.push({
      description,
      quantity,
      unitPrice,
      amount,
      quickbooks_item_id: item.quickbooks_item_id || undefined,
      serviceId,
      category,
      serviceName,
      lineType: 'invoice_line',
      priceSource: 'invoice_line_item',
    });
  }

  return { lines, warnings };
}