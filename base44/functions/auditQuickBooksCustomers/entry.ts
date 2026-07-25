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

    // 5. Targeted lookups — filter customers by DisplayName / CompanyName
    const searchTerms = ['Silver Hill', 'Weitzman', 'USTA', 'Partner Reinsurance'];
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

    // 8. Assemble report
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