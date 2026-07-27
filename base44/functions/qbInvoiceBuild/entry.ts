import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, findQBCustomer, QB_API_URL } from '../../shared/quickbooksAuth.ts';
import { linesFromProposal, buildInvoiceBody } from '../../shared/quickbooksInvoiceBuilder.ts';
import { isExcludedDomain } from '../../shared/emailDomain.ts';
import { computeFingerprint } from '../../shared/invoiceFingerprint.ts';

// ── Dry-run invoice builder ─────────────────────────────────────────
// Takes a proposal_id and returns the exact JSON body that would be POSTed
// to /v3/company/{realmId}/invoice — without sending it.
//
// Body assembly is delegated to the shared buildInvoiceBody function.
// This file owns: proposal loading, customer resolution, and the
// reconciliation choices (TxnDate, CustomerMemo, DocNumber).
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

    // ── Load all services (for Item resolution + price lookup) ──
    const allServices = await base44.asServiceRole.entities.Service.list('name', 500);
    const serviceMap = new Map(allServices.map(s => [s.id, s]));

    // ── Resolve QB customer (strictly sequential) ──
    const realmId = await getRealmId(base44);
    if (!realmId) return Response.json({ error: 'No realm_id configured' }, { status: 500 });
    const { accessToken, tokenRotated } = await getAccessToken(base44);

    // Step 1: exact email
    let customerLookup = await findQBCustomer(accessToken, realmId, clientEmail);
    let matchStrategy = 'exact_email';
    let customerDisplayName = customerLookup.displayName || null;
    let customerEmailFromQB = customerLookup.email || null;

    // Step 2: email domain (skip for free-mail providers)
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
            customerDisplayName = matches[0].DisplayName || null;
            customerEmailFromQB = matches[0].PrimaryEmailAddr?.Address || null;
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
        const nameQuery = `SELECT Id, DisplayName, PrimaryEmailAddr FROM Customer WHERE DisplayName = '${displayName}' MAXRESULTS 10`;
        const nameResp = await fetch(
          `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(nameQuery)}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
        );
        if (nameResp.ok) {
          const nameData = await nameResp.json();
          const matches = nameData.QueryResponse?.Customer || [];
          if (matches.length === 1) {
            customerLookup = { status: 'found', customerId: matches[0].Id };
            customerDisplayName = matches[0].DisplayName || null;
            customerEmailFromQB = matches[0].PrimaryEmailAddr?.Address || null;
            matchStrategy = 'display_name';
          }
        }
      }
    }

    const customerResolution = {
      strategy: matchStrategy,
      status: customerLookup.status,
      customer_id: customerLookup.customerId || null,
      customer_display_name: customerDisplayName,
      customer_email: customerEmailFromQB,
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

    // ── Build normalised lines from Proposal ──
    const { lines, warnings: lineWarnings, blockingErrors: priceBlockingErrors } = linesFromProposal(
      proposal.selections, serviceMap, allServices
    );

    // ── Build invoice body (shared builder) ──
    // Reconciliation choices for the Proposal path:
    //   TxnDate: today (no Invoice exists yet for this proposal)
    //   CustomerMemo: not available from Proposal (omitted)
    //   DocNumber: only if the app already has one on an existing Invoice
    const existingWithDocNumber = existingInvoices.find((inv: any) => inv.invoice_number);

    const { body: invoiceBody, lineAnalysis, blockingErrors: itemBlockingErrors, warnings } = buildInvoiceBody({
      customerId: customerLookup.customerId,
      customerEmail: clientEmail,
      txnDate: new Date().toISOString().split('T')[0],
      lines,
      docNumber: existingWithDocNumber?.invoice_number,
      serviceMap,
    });

    const allWarnings = [...warnings, ...lineWarnings];
    const allBlockingErrors = [...priceBlockingErrors, ...itemBlockingErrors];

    // Return 200 even with blocking errors — the review screen needs to
    // display them alongside the customer resolution. The Send button is
    // disabled when blocking_errors is non-empty.
    if (allBlockingErrors.length > 0) {
      const fingerprint = await computeFingerprint(invoiceBody);
      return Response.json({
        dry_run: true,
        blocking_errors: allBlockingErrors,
        message: 'Cannot send — one or more lines have a blocking error (missing price or missing QuickBooks Item).',
        customer_resolution: customerResolution,
        invoice_body: invoiceBody,
        line_analysis: lineAnalysis,
        warnings: allWarnings,
        fingerprint,
      });
    }

    const fingerprint = await computeFingerprint(invoiceBody);

    return Response.json({
      dry_run: true,
      token_rotated: tokenRotated,
      proposal_id,
      customer_resolution: customerResolution,
      invoice_body: invoiceBody,
      fingerprint,
      line_count: lines.length,
      line_analysis: lineAnalysis,
      warnings: allWarnings,
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