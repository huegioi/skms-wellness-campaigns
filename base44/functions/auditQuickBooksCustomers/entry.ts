import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getRealmId, getAccessToken, QB_API_URL } from '../../shared/quickbooksAuth.ts';

// ─── Read-only QBO query helper ─────────────────────────────────────
// Checks .ok on every response, reports HTTP status, and captures errors
// rather than returning empty arrays silently.

async function qbQuery(accessToken, realmId, query) {
  const response = await fetch(
    `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  const httpStatus = response.status;
  const ok = response.ok;

  if (!ok) {
    const errorText = await response.text();
    return { ok, http_status: httpStatus, error: errorText, data: null };
  }

  const result = await response.json();
  return { ok, http_status: httpStatus, error: null, data: result.QueryResponse || {} };
}

function computeInvoiceStatus(qbInv) {
  if (qbInv.Balance === 0) return 'paid';
  if (qbInv.DueDate && new Date(qbInv.DueDate) < new Date()) return 'overdue';
  return 'sent';
}

// ─── Main handler ───────────────────────────────────────────────────
// READ-ONLY: No QuickBooks writes (no POST/PUT/DELETE to QBO entity endpoints).
// No Base44 entity writes. The only write is the rotated refresh token saved
// to the DB QuickBooksConfig record by getAccessToken (shared module) —
// QuickBooks rotates on every use; not saving would break quickbooksSync.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // 1. Resolve realm + token from DB (same store quickbooksSync uses)
    const realmId = await getRealmId(base44);
    if (!realmId) {
      return Response.json({ error: 'No realm_id found in QuickBooksConfig DB record.' }, { status: 500 });
    }

    const { accessToken, tokenRotated } = await getAccessToken(base44);

    // 2. Fetch all QB customers (MAXRESULTS 1000)
    const customerResult = await qbQuery(accessToken, realmId, 'SELECT * FROM Customer MAXRESULTS 1000');
    const allCustomers = customerResult.data?.Customer || [];
    const customersTruncated = allCustomers.length === 1000;

    // Optional: compact filtered lookup for customer ID resolution.
    // Returns ONLY matching customers (by DisplayName/CompanyName substring)
    // including those without email — keeps the response tiny for one-off lookups.
    if (body.filter_terms && Array.isArray(body.filter_terms)) {
      const terms = body.filter_terms.map(t => String(t).toLowerCase());
      const filtered = allCustomers
        .filter(c => {
          const dn = (c.DisplayName || '').toLowerCase();
          const cn = (c.CompanyName || '').toLowerCase();
          return terms.some(t => dn.includes(t) || cn.includes(t));
        })
        .map(c => ({
          Id: c.Id,
          DisplayName: c.DisplayName || '',
          CompanyName: c.CompanyName || '',
          PrimaryEmailAddr: c.PrimaryEmailAddr?.Address || null,
          Active: c.Active
        }));
      const matchedTerms = new Set();
      for (const c of filtered) {
        const dn = c.DisplayName.toLowerCase();
        const cn = c.CompanyName.toLowerCase();
        for (const t of terms) {
          if (dn.includes(t) || cn.includes(t)) { matchedTerms.add(t); break; }
        }
      }
      return Response.json({
        read_only: true,
        token_refreshed: true,
        rotated_token_saved: tokenRotated,
        total_customers_searched: allCustomers.length,
        matched_count: filtered.length,
        filtered_customers: filtered,
        unmatched_terms: terms.filter(t => !matchedTerms.has(t))
      });
    }

    // 3. Fetch all QB invoices (MAXRESULTS 1000)
    const invoiceResult = await qbQuery(accessToken, realmId, 'SELECT * FROM Invoice MAXRESULTS 1000');
    const allInvoices = invoiceResult.data?.Invoice || [];
    const invoicesTruncated = allInvoices.length === 1000;

    // 4. Fetch all Base44 Clients for email match check (quickbooksSync:555)
    const localClients = await base44.asServiceRole.entities.Client.list('-created_date', 1000);
    const clientsTruncated = localClients.length === 1000;
    const clientEmailMap = new Map();
    for (const c of localClients) {
      if (c.email) {
        clientEmailMap.set(c.email.toLowerCase(), c);
      }
    }

    // 4b. Fetch all Base44 Invoices for gap reconciliation
    const localInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 2000);
    const localQBIds = new Set(localInvoices.filter(i => i.quickbooks_id).map(i => String(i.quickbooks_id)));

    // 5. Targeted lookups — filter customers by DisplayName / CompanyName
    const searchTerms = ['Silver Hill', 'Weitzman', 'USTA', 'Partner Reinsurance', 'AVCO'];
    const targetedLookups = searchTerms.map(term => {
      const termLower = term.toLowerCase();
      const matches = allCustomers.filter(c => {
        const dn = (c.DisplayName || '').toLowerCase();
        const cn = (c.CompanyName || '').toLowerCase();
        return dn.includes(termLower) || cn.includes(termLower);
      }).map(c => {
        const customerInvoices = allInvoices.filter(inv => inv.CustomerRef?.value === c.Id);
        return {
          Id: c.Id,
          DisplayName: c.DisplayName || null,
          CompanyName: c.CompanyName || null,
          PrimaryEmailAddr: c.PrimaryEmailAddr?.Address || null,
          Active: c.Active,
          Balance: c.Balance || 0,
          invoices: customerInvoices.map(inv => ({
            DocNumber: inv.DocNumber || null,
            TxnDate: inv.TxnDate || null,
            TotalAmt: inv.TotalAmt || 0,
            Balance: inv.Balance || 0,
            status: computeInvoiceStatus(inv)
          }))
        };
      });
      return { search_term: term, match_count: matches.length, matches };
    });

    // 6. Systemic number — the dollar value quickbooksSync:500 silently skips
    const customersWithEmail = allCustomers.filter(c => c.PrimaryEmailAddr?.Address);
    const customersWithoutEmail = allCustomers.filter(c => !c.PrimaryEmailAddr?.Address);
    const noEmailCustomerIds = new Set(customersWithoutEmail.map(c => c.Id));
    const invoicesForNoEmailCustomers = allInvoices.filter(inv => noEmailCustomerIds.has(inv.CustomerRef?.value));
    const skippedTotalAmt = invoicesForNoEmailCustomers.reduce((sum, inv) => sum + (inv.TotalAmt || 0), 0);

    // 7. Match check — for each customer with email, does a Base44 Client exist?
    const matchCheck = customersWithEmail.map(c => {
      const email = c.PrimaryEmailAddr.Address;
      const emailLower = email.toLowerCase();
      const matchedClient = clientEmailMap.get(emailLower);
      return {
        qb_customer_id: c.Id,
        display_name: c.DisplayName,
        email: email,
        has_base44_client: !!matchedClient,
        base44_client_id: matchedClient?.id || null,
        base44_client_name: matchedClient?.name || null
      };
    });

    // 8. Gap reconciliation — QB invoices whose Id has no matching quickbooks_id in Base44
    const customerById = new Map(allCustomers.map(c => [c.Id, c]));
    const qbInvoicesMissingInBase44 = allInvoices
      .filter(inv => !localQBIds.has(String(inv.Id)))
      .map(inv => {
        const cust = customerById.get(inv.CustomerRef?.value);
        return {
          qb_invoice_id: inv.Id,
          DocNumber: inv.DocNumber || null,
          customer_display_name: cust?.DisplayName || null,
          customer_email: cust?.PrimaryEmailAddr?.Address || null,
          TxnDate: inv.TxnDate || null,
          TotalAmt: inv.TotalAmt || 0
        };
      });
    const missingTotalAmt = qbInvoicesMissingInBase44.reduce((sum, inv) => sum + (inv.TotalAmt || 0), 0);

    // 9. Assemble report
    return Response.json({
      read_only: true,
      token: {
        realm_resolved: !!realmId,
        token_refreshed: true,
        rotated_token_saved: tokenRotated,
        note: 'Rotated refresh token saved to same DB QuickBooksConfig record quickbooksSync uses. No QuickBooks or Base44 entity data was written.'
      },
      queries: {
        customers: {
          ok: customerResult.ok,
          http_status: customerResult.http_status,
          error: customerResult.error,
          returned: allCustomers.length,
          returned_exactly_1000: customersTruncated,
          truncated: customersTruncated
        },
        invoices: {
          ok: invoiceResult.ok,
          http_status: invoiceResult.http_status,
          error: invoiceResult.error,
          returned: allInvoices.length,
          returned_exactly_1000: invoicesTruncated,
          truncated: invoicesTruncated
        },
        base44_clients: {
          returned: localClients.length,
          returned_exactly_1000: clientsTruncated,
          truncated: clientsTruncated
        }
      },
      targeted_lookups: targetedLookups,
      systemic: {
        total_customers: allCustomers.length,
        customers_with_email: customersWithEmail.length,
        customers_without_email: customersWithoutEmail.length,
        invoices_for_no_email_customers: invoicesForNoEmailCustomers.length,
        skipped_total_amount: skippedTotalAmt,
        note: 'This is the dollar value quickbooksSync silently skips at line 500 (if (!email) continue;). These customers exist in QB with invoices but are never imported because they have no PrimaryEmailAddr.'
      },
      match_check: matchCheck,
      gap_reconciliation: {
        qb_invoice_count: allInvoices.length,
        base44_invoice_count: localInvoices.length,
        base44_invoices_with_quickbooks_id: localQBIds.size,
        missing_from_base44_count: qbInvoicesMissingInBase44.length,
        missing_from_base44_total_amount: missingTotalAmt,
        missing_invoices: qbInvoicesMissingInBase44
      },
      truncation: {
        customers_returned_exactly_1000: customersTruncated,
        invoices_returned_exactly_1000: invoicesTruncated,
        any_truncated: customersTruncated || invoicesTruncated
      }
    });

  } catch (error) {
    console.error('auditQuickBooksCustomers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});