import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, findQBCustomer, QB_API_URL } from '../../shared/quickbooksAuth.ts';
import { QB_CATEGORY_ITEM_DEFAULTS, QB_SALES_ITEM_ID } from '../../shared/quickbooksItems.ts';
import { BOX_DISPLAY_NAMES, BOX_KEY_TO_SERVICE_NAME, WELLNESS_BOX_FALLBACK_PRICES } from '../../shared/wellnessBoxes.ts';
import { isExcludedDomain } from '../../shared/emailDomain.ts';

// ── Dry-run invoice builder ─────────────────────────────────────────
// Takes a proposal_id and returns the exact JSON body that would be POSTed
// to /v3/company/{realmId}/invoice — without sending it.
//
// No QuickBooks writes. The only write is the rotated refresh token saved
// by getAccessToken (shared module) — QuickBooks rotates on every use.
//
// QB API calls are strictly sequential (one at a time) because Intuit
// rotates the refresh token on every use; concurrent calls poison each other.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { proposal_id } = body;
    if (!proposal_id) return Response.json({ error: 'proposal_id required' }, { status: 400 });

    // ── Load proposal ──
    const proposal = await base44.asServiceRole.entities.Proposal.get(proposal_id);
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    // ── Idempotency guard ──
    // Check if any Invoice linked to this proposal already has a quickbooks_id.
    // See Part 4 report: the Proposal entity has no quickbooks_invoice_id field,
    // so we check via the Invoice entity's proposal_id → quickbooks_id link.
    const existingInvoices = await base44.asServiceRole.entities.Invoice.filter({ proposal_id });
    const alreadyInvoiced = existingInvoices.find((inv: any) => inv.quickbooks_id);
    if (alreadyInvoiced) {
      return Response.json({
        dry_run: true,
        blocked: 'idempotency',
        message: 'This proposal already has a QuickBooks invoice.',
        existing_invoice_id: alreadyInvoiced.id,
        existing_quickbooks_id: alreadyInvoiced.quickbooks_id,
        existing_doc_number: alreadyInvoiced.invoice_number || null,
      }, { status: 409 });
    }

    // ── Load client for customer resolution ──
    let client: any = null;
    if (proposal.client_id) {
      try { client = await base44.asServiceRole.entities.Client.get(proposal.client_id); } catch {}
    }

    const clientEmail = (proposal.client_email || client?.email || '').toLowerCase().trim();
    if (!clientEmail) {
      return Response.json({ error: 'No client email available for customer resolution' }, { status: 400 });
    }

    // ── Load all services ──
    const allServices = await base44.asServiceRole.entities.Service.list('name', 500);
    const serviceMap = new Map(allServices.map(s => [s.id, s]));

    // ── Resolve QB customer (strictly sequential) ──
    const realmId = await getRealmId(base44);
    if (!realmId) return Response.json({ error: 'No realm_id configured' }, { status: 500 });
    const { accessToken, tokenRotated } = await getAccessToken(base44);

    // Step 1: exact email (using the fixed findQBCustomer)
    let customerLookup = await findQBCustomer(accessToken, realmId, clientEmail);
    let matchStrategy = 'exact_email';

    // Step 2: email domain (skip for free-mail providers — they identify a person, not an org)
    if (customerLookup.status === 'not_found') {
      const domain = clientEmail.split('@')[1];
      if (domain && !isExcludedDomain(domain)) {
        const domainQuery = `SELECT Id, DisplayName, PrimaryEmailAddr FROM Customer WHERE PrimaryEmailAddr LIKE '%@${domain}' MAXRESULTS 50`;
        const domainResp = await fetch(
          `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(domainQuery)}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
        );
        if (domainResp.ok) {
          const domainData = await domainResp.json();
          const matches = domainData.QueryResponse?.Customer || [];
          if (matches.length === 1) {
            customerLookup = { status: 'found', customerId: matches[0].Id };
            matchStrategy = 'email_domain';
          } else if (matches.length > 1) {
            matchStrategy = 'domain_ambiguous';
          }
        }
      } else {
        matchStrategy = 'domain_skipped_freemail';
      }
    }

    // Step 3: DisplayName
    if (customerLookup.status === 'not_found') {
      const displayName = (client?.company || proposal.company || proposal.client_name || '').replace(/'/g, "\\'");
      if (displayName) {
        const nameQuery = `SELECT Id, DisplayName FROM Customer WHERE DisplayName = '${displayName}' MAXRESULTS 10`;
        const nameResp = await fetch(
          `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(nameQuery)}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
        );
        if (nameResp.ok) {
          const nameData = await nameResp.json();
          const matches = nameData.QueryResponse?.Customer || [];
          if (matches.length === 1) {
            customerLookup = { status: 'found', customerId: matches[0].Id };
            matchStrategy = 'display_name';
          }
        }
      }
    }

    const customerResolution = {
      strategy: matchStrategy,
      status: customerLookup.status,
      customer_id: customerLookup.customerId || null,
      email_searched: clientEmail,
      error: customerLookup.error || null,
    };

    if (customerLookup.status === 'error') {
      return Response.json({
        dry_run: true,
        customer_resolution: customerResolution,
        error: `Customer search failed: ${customerLookup.error}`,
      }, { status: 502 });
    }

    if (customerLookup.status !== 'found') {
      return Response.json({
        dry_run: true,
        customer_resolution: customerResolution,
        error: 'Customer not found in QuickBooks. Dry run does not create customers.',
      }, { status: 404 });
    }

    // ── Build invoice lines ──
    const s = proposal.selections || {};
    const overrides = s.priceOverrides || {};
    const lines: any[] = [];
    const lineAnalysis: any[] = [];
    const warnings: string[] = [];
    const blockingErrors: any[] = [];

    // Helper: resolve ItemRef for a Service
    function resolveItemRef(serviceId: string) {
      const svc = serviceMap.get(serviceId);
      if (svc?.quickbooks_item_id) {
        return { value: svc.quickbooks_item_id, source: 'service_level', itemName: svc.qb_item_name || svc.name };
      }
      if (svc?.category) {
        const def = QB_CATEGORY_ITEM_DEFAULTS[svc.category];
        if (def) {
          return { value: def.itemId, source: 'category_default', itemName: def.itemName };
        }
      }
      return { value: null, source: 'no_item', itemName: null };
    }

    // Helper: resolve price for a non-box Service, snapshot-first
    function resolveServicePrice(serviceId: string, dataKey: string) {
      // 1. priceOverrides
      if (overrides[serviceId] !== undefined) {
        return { price: overrides[serviceId], source: 'price_override' };
      }
      // 2. *Data array snapshot
      const dataArr = s[dataKey] || [];
      const dataEntry = dataArr.find((x: any) => x.id === serviceId);
      if (dataEntry && dataEntry.price > 0) {
        return { price: dataEntry.price, source: 'proposal_snapshot' };
      }
      // 3. Live Service price
      const svc = serviceMap.get(serviceId);
      if (svc && svc.price > 0) {
        warnings.push(`Line for "${svc.name}" (${serviceId}) used live Service price ($${svc.price}) — no proposal snapshot found.`);
        return { price: svc.price, source: 'live_service_price' };
      }
      // 4. Fallback
      warnings.push(`Line for service ${serviceId} has no price from any source — defaulted to $0.`);
      return { price: 0, source: 'fallback_zero' };
    }

    // ── Workshops ──
    for (const id of (s.workshops || [])) {
      const { price, source } = resolveServicePrice(id, 'workshopsData');
      const itemRef = resolveItemRef(id);
      const svc = serviceMap.get(id);
      if (itemRef.source === 'no_item') {
        blockingErrors.push({ type: 'workshop', service_id: id, name: svc?.name, category: svc?.category, reason: 'No QuickBooks Item — Service has no quickbooks_item_id and no category default' });
        continue;
      }
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: price,
        Description: svc?.name || 'Workshop',
        SalesItemLineDetail: {
          ItemRef: { value: itemRef.value },
          Qty: 1,
          UnitPrice: price,
        },
      });
      lineAnalysis.push({ type: 'workshop', service_id: id, name: svc?.name, item_source: itemRef.source, item_name: itemRef.itemName, price_source: source, price, qty: 1 });
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
        const result = resolveServicePrice(id, 'challengeData');
        price = result.price; source = result.source;
      }
      const itemRef = resolveItemRef(id);
      const svc = serviceMap.get(id);
      if (itemRef.source === 'no_item') {
        blockingErrors.push({ type: 'challenge', service_id: id, name: svc?.name, category: svc?.category, reason: 'No QuickBooks Item — Service has no quickbooks_item_id and no category default' });
        continue;
      }
      const qty = s.challengeParticipants || s.participantCount || 1;
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: price * qty,
        Description: svc?.name || 'Challenge',
        SalesItemLineDetail: {
          ItemRef: { value: itemRef.value },
          Qty: qty,
          UnitPrice: price,
        },
      });
      lineAnalysis.push({ type: 'challenge', service_id: id, name: svc?.name, item_source: itemRef.source, item_name: itemRef.itemName, price_source: source, price, qty });
    }

    // ── Leadership ──
    for (const id of (s.leadership || [])) {
      const { price, source } = resolveServicePrice(id, 'leadershipData');
      const itemRef = resolveItemRef(id);
      const svc = serviceMap.get(id);
      if (itemRef.source === 'no_item') {
        blockingErrors.push({ type: 'leadership', service_id: id, name: svc?.name, category: svc?.category, reason: 'No QuickBooks Item — Service has no quickbooks_item_id and no category default' });
        continue;
      }
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: price,
        Description: svc?.name || 'Leadership',
        SalesItemLineDetail: {
          ItemRef: { value: itemRef.value },
          Qty: 1,
          UnitPrice: price,
        },
      });
      lineAnalysis.push({ type: 'leadership', service_id: id, name: svc?.name, item_source: itemRef.source, item_name: itemRef.itemName, price_source: source, price, qty: 1 });
    }

    // ── Movement classes ──
    for (const id of (s.movementClasses || [])) {
      const { price, source } = resolveServicePrice(id, 'movementClassesData');
      const itemRef = resolveItemRef(id);
      const svc = serviceMap.get(id);
      if (itemRef.source === 'no_item') {
        blockingErrors.push({ type: 'class', service_id: id, name: svc?.name, category: svc?.category, reason: 'No QuickBooks Item — Service has no quickbooks_item_id and no category default' });
        continue;
      }
      const qty = (s.movementClassSessions && s.movementClassSessions[id]) || 1;
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: price * qty,
        Description: svc?.name || 'Class',
        SalesItemLineDetail: {
          ItemRef: { value: itemRef.value },
          Qty: qty,
          UnitPrice: price,
        },
      });
      lineAnalysis.push({ type: 'class', service_id: id, name: svc?.name, item_source: itemRef.source, item_name: itemRef.itemName, price_source: source, price, qty });
    }

    // ── Wellness boxes (one line per box type with non-zero qty) ──
    const boxQtys = s.sampleBoxQuantities || {};
    const boxSnapshot = s.sampleBoxPrices || {};
    for (const [key, qty] of Object.entries(boxQtys)) {
      if (!qty) continue;
      const boxSvcName = BOX_KEY_TO_SERVICE_NAME[key];
      const boxSvc = allServices.find(svc => svc.category === 'wellness_box' && svc.name === boxSvcName);
      let price: number, source: string;
      // 1. sampleBoxPrices snapshot
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
      // Resolve box ItemRef: box Service's quickbooks_item_id → category default
      const boxItemRef = boxSvc?.quickbooks_item_id
        ? { value: boxSvc.quickbooks_item_id, source: 'service_level', itemName: boxSvc.qb_item_name || boxSvc.name }
        : { value: QB_CATEGORY_ITEM_DEFAULTS.wellness_box.itemId, source: 'category_default', itemName: QB_CATEGORY_ITEM_DEFAULTS.wellness_box.itemName };
      if (!boxItemRef.value) {
        blockingErrors.push({ type: 'wellness_box', box_key: key, name: displayName, category: 'wellness_box', reason: 'No QuickBooks Item — no Service quickbooks_item_id and no category default' });
        continue;
      }
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: price * qty,
        Description: displayName,
        SalesItemLineDetail: {
          ItemRef: { value: boxItemRef.value },
          Qty: qty,
          UnitPrice: price,
        },
      });
      lineAnalysis.push({ type: 'wellness_box', box_key: key, name: displayName, item_source: boxItemRef.source, item_name: boxItemRef.itemName, price_source: source, price, qty });
    }

    // ── Custom wellness box ──
    const customBoxQty = s.customBoxQuantity || 0;
    const customBoxItems = s.customBoxItems || [];
    if (customBoxQty > 0 && customBoxItems.length > 0) {
      const unitPrice = customBoxItems.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: unitPrice * customBoxQty,
        Description: 'Custom Wellness Box',
        SalesItemLineDetail: {
          ItemRef: { value: QB_CATEGORY_ITEM_DEFAULTS.wellness_box.itemId },
          Qty: customBoxQty,
          UnitPrice: unitPrice,
        },
      });
      lineAnalysis.push({ type: 'custom_wellness_box', name: 'Custom Wellness Box', item_source: 'category_default', item_name: QB_CATEGORY_ITEM_DEFAULTS.wellness_box.itemName, price_source: 'custom_box_items', price: unitPrice, qty: customBoxQty });
    }

    // ── Custom charges (routed to generic Sales Item) ──
    for (const charge of (s.customCharges || [])) {
      const amount = charge.amount || 0;
      const label = charge.label || charge.description || 'Custom Charge';
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: amount,
        Description: label,
        SalesItemLineDetail: {
          ItemRef: { value: QB_SALES_ITEM_ID },
          Qty: 1,
          UnitPrice: amount,
        },
      });
      lineAnalysis.push({ type: 'custom_charge', name: label, item_source: 'generic_sales', item_name: 'Sales', price_source: 'custom_charge', price: amount, qty: 1 });
    }

    // ── Blocking errors: any line with no Item makes the body invalid ──
    if (blockingErrors.length > 0) {
      return Response.json({
        dry_run: true,
        blocked: 'missing_item_refs',
        blocking_errors: blockingErrors,
        message: 'Cannot build invoice — one or more lines have no QuickBooks Item.',
        customer_resolution: customerResolution,
      }, { status: 422 });
    }

    // ── Assemble invoice body ──
    // This app creates invoices UNSENT by design — no EmailStatus, no
    // DeliveryInfo, no SalesTermRef, no DueDate in the body. BillEmail
    // populates the recipient field for when William sends manually.
    const invoiceBody: any = {
      CustomerRef: { value: customerLookup.customerId },
      TxnDate: new Date().toISOString().split('T')[0],
      BillEmail: { Address: clientEmail },
      Line: lines,
    };

    // DocNumber: include only if the app already has one for this proposal
    const existingWithDocNumber = existingInvoices.find((inv: any) => inv.invoice_number);
    if (existingWithDocNumber?.invoice_number) {
      invoiceBody.DocNumber = existingWithDocNumber.invoice_number;
    }

    // No TxnTaxDetail — tax is set by hand in QuickBooks, not by the app.

    return Response.json({
      dry_run: true,
      token_rotated: tokenRotated,
      proposal_id,
      customer_resolution: customerResolution,
      invoice_body: invoiceBody,
      line_count: lines.length,
      line_analysis: lineAnalysis,
      warnings,
      lines_using_service_level_item: lineAnalysis.filter(l => l.item_source === 'service_level').map(l => ({ name: l.name, item_name: l.item_name })),
      lines_using_category_default: lineAnalysis.filter(l => l.item_source === 'category_default').map(l => ({ name: l.name, item_name: l.item_name, category: l.type })),
      prices_from_live_service: lineAnalysis.filter(l => l.price_source === 'live_service_price').map(l => ({ name: l.name, price: l.price })),
      prices_from_fallback: lineAnalysis.filter(l => l.price_source === 'fallback_constant' || l.price_source === 'fallback_zero').map(l => ({ name: l.name, price: l.price, source: l.price_source })),
    });

  } catch (error) {
    console.error('qbInvoiceBuild error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});