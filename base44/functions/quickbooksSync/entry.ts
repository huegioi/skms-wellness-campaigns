import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { getOrgDomain, deriveCompanyFromEmail, buildClientDomainIndex } from '../../shared/emailDomain.ts';
import { findQBCustomer } from '../../shared/quickbooksAuth.ts';
import { linesFromInvoice, buildInvoiceBody } from '../../shared/quickbooksInvoiceBuilder.ts';

const QB_API_URL = 'https://quickbooks.api.intuit.com/v3/company';

// Token cache to avoid refreshing on every request
let cachedAccessToken = null;
let tokenExpiresAt = null;

async function getStoredRefreshToken(client) {
  // Try DB first (for rotated tokens), fall back to env var
  try {
    const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'refresh_token' });
    if (configs && configs.length > 0) {
      return configs[0].value;
    }
  } catch (e) {
    console.log('Could not read refresh token from DB, using env var:', e.message);
  }
  return Deno.env.get('QUICKBOOKS_REFRESH_TOKEN');
}

async function saveRefreshToken(client, newToken) {
  try {
    const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'refresh_token' });
    if (configs && configs.length > 0) {
      await client.asServiceRole.entities.QuickBooksConfig.update(configs[0].id, {
        value: newToken,
        updated_at: new Date().toISOString()
      });
    } else {
      await client.asServiceRole.entities.QuickBooksConfig.create({
        key: 'refresh_token',
        value: newToken,
        updated_at: new Date().toISOString()
      });
    }
    console.log('New QuickBooks refresh token saved to DB successfully.');
  } catch (e) {
    console.error('Failed to save refresh token to DB:', e.message);
    throw new Error('Token rotated by QuickBooks but could not save new token: ' + e.message);
  }
}

async function getRealmId(client) {
  try {
    const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'realm_id' });
    if (configs && configs.length > 0) {
      return configs[0].value;
    }
  } catch (e) {
    console.log('Could not read realm ID from DB, using env var:', e.message);
  }
  return Deno.env.get('QUICKBOOK_REALM_ID');
}

async function getAccessToken(client) {
  // Check if we have a valid cached token
  if (cachedAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  // Token expired or doesn't exist, refresh it
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  const refreshToken = await getStoredRefreshToken(client);

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = 'QuickBooks refresh token expired or invalid. Please reconnect QuickBooks in the Dashboard settings.';
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error === 'invalid_grant') {
        errorMsg = 'QuickBooks connection expired. Please reconnect: The refresh token is no longer valid (tokens expire after 100 days of inactivity).';
      } else {
        errorMsg = errorData.error_description || errorData.error || errorMsg;
      }
    } catch {
      errorMsg = errorText;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();

  // Cache the access token (expires in 3600 seconds = 1 hour, refresh 5 min early for safety)
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 300) * 1000;

  // CRITICAL: QuickBooks rotates refresh tokens on every use.
  // Save the new token to the DB so rotation is handled automatically.
  if (data.refresh_token) {
    await saveRefreshToken(client, data.refresh_token);
  }

  return cachedAccessToken;
}

async function createQBCustomer(accessToken, realmId, clientData) {
  const customerData = {
    DisplayName: clientData.company || clientData.client_name,
    PrimaryEmailAddr: { Address: clientData.client_email },
    CompanyName: clientData.company,
    GivenName: clientData.client_name.split(' ')[0],
    FamilyName: clientData.client_name.split(' ').slice(1).join(' ')
  };

  const response = await fetch(`${QB_API_URL}/${realmId}/customer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(customerData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = 'Failed to create customer';
    try {
      const errorData = JSON.parse(errorText);
      errorMsg = errorData.Fault?.Error?.[0]?.Message || errorMsg;
    } catch {
      errorMsg = errorText;
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return result.Customer.Id;
}

// findQBCustomer moved to shared/quickbooksAuth.ts — returns { status, customerId, error }
// Callers must check .status === 'error' and abort rather than creating a customer.

async function createQBInvoice(accessToken, realmId, invoiceBody) {
  // Body is pre-built by buildInvoiceBody (shared module) — this function
  // only POSTs it. The body is always UNSENT: no EmailStatus, no
  // DeliveryInfo, no SalesTermRef, no DueDate. BillEmail populates the
  // recipient field for manual dispatch — it does not trigger delivery.
  // DueDate is read back from the POST response (QuickBooks applies the
  // customer's default terms).
  const response = await fetch(`${QB_API_URL}/${realmId}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(invoiceBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = 'Failed to create invoice';
    try {
      const errorData = JSON.parse(errorText);
      errorMsg = errorData.Fault?.Error?.[0]?.Message || errorMsg;
    } catch {
      errorMsg = errorText;
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return result.Invoice;
}

async function getQBInvoice(accessToken, realmId, invoiceId) {
  const response = await fetch(`${QB_API_URL}/${realmId}/invoice/${invoiceId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = 'Failed to get invoice';
    try {
      const errorData = JSON.parse(errorText);
      errorMsg = errorData.Fault?.Error?.[0]?.Message || errorMsg;
    } catch {
      errorMsg = errorText;
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return result.Invoice;
}

async function getQBPayments(accessToken, realmId, invoiceId) {
  const query = `SELECT * FROM Payment WHERE Line.LinkedTxn.TxnId = '${invoiceId}'`;
  const response = await fetch(
    `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) return [];

  const result = await response.json();
  return result.QueryResponse?.Payment || [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, invoiceId, dateFrom, dateTo, statusFilter } = await req.json();
    const realmId = await getRealmId(base44);

    if (!realmId) {
      return Response.json({ error: 'QuickBooks not configured' }, { status: 500 });
    }

    const accessToken = await getAccessToken(base44);

    if (action === 'createInvoice') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];

      if (!invoiceData.client_email) {
        return Response.json({ error: 'Invoice missing client email' }, { status: 400 });
      }

      if (!invoiceData.line_items || invoiceData.line_items.length === 0) {
        return Response.json({ error: 'Invoice must have at least one line item' }, { status: 400 });
      }

      const lookup = await findQBCustomer(accessToken, realmId, invoiceData.client_email);
      if (lookup.status === 'error') {
        return Response.json({ error: `Customer search failed: ${lookup.error}` }, { status: 502 });
      }
      let customerId = lookup.customerId;
      if (!customerId) {
        customerId = await createQBCustomer(accessToken, realmId, invoiceData);
      }

      // Load services for Item resolution (same shared path as the Proposal dry-run)
      const allServices = await base44.asServiceRole.entities.Service.list('name', 500);
      const serviceMap = new Map(allServices.map(s => [s.id, s]));

      const { lines, warnings: lineWarnings } = linesFromInvoice(invoiceData.line_items, allServices);

      // Reconciliation choices for the Invoice path:
      //   TxnDate: the Invoice's issue_date
      //   CustomerMemo: include when present
      //   DocNumber: only when the app already has one
      const { body: invoiceBody, lineAnalysis, blockingErrors, warnings } = buildInvoiceBody({
        customerId,
        customerEmail: invoiceData.client_email,
        txnDate: invoiceData.issue_date,
        lines,
        memo: invoiceData.memo,
        docNumber: invoiceData.invoice_number,
        serviceMap,
      });

      if (blockingErrors.length > 0) {
        return Response.json({
          error: 'Cannot build invoice — one or more lines have no QuickBooks Item.',
          blocking_errors: blockingErrors,
          line_analysis: lineAnalysis,
        }, { status: 422 });
      }

      const qbInvoice = await createQBInvoice(accessToken, realmId, invoiceBody);

      await base44.asServiceRole.entities.Invoice.update(invoiceId, {
        quickbooks_id: qbInvoice.Id,
        quickbooks_sync_date: new Date().toISOString(),
        status: 'created_in_quickbooks',
        due_date: qbInvoice.DueDate || null
      });

      return Response.json({
        success: true,
        quickbooks_id: qbInvoice.Id,
        invoice_number: qbInvoice.DocNumber,
        due_date: qbInvoice.DueDate || null,
        message: 'Created in QuickBooks — not yet sent'
      });
    }

    if (action === 'syncInvoice') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];
      if (!invoiceData.quickbooks_id) {
        return Response.json({ error: 'Invoice not synced to QuickBooks yet' }, { status: 400 });
      }

      const qbInvoice = await getQBInvoice(accessToken, realmId, invoiceData.quickbooks_id);
      const payments = await getQBPayments(accessToken, realmId, invoiceData.quickbooks_id);

      let status = invoiceData.status;
      let paidDate = null;

      if (qbInvoice.Balance === 0) {
        status = 'paid';
        if (payments.length > 0) {
          const sortedPayments = payments.sort((a, b) => new Date(b.TxnDate) - new Date(a.TxnDate));
          paidDate = sortedPayments[0].TxnDate;
        } else {
          paidDate = new Date().toISOString().split('T')[0];
        }
      } else if (new Date(qbInvoice.DueDate) < new Date()) {
        status = 'overdue';
      } else if (invoiceData.status === 'created_in_quickbooks' && qbInvoice.EmailStatus !== 'EmailSent') {
        status = 'created_in_quickbooks';
      } else {
        status = 'sent';
      }

      await base44.asServiceRole.entities.Invoice.update(invoiceId, {
        status,
        quickbooks_sync_date: new Date().toISOString(),
        paid_date: paidDate
      });

      return Response.json({
        success: true,
        status,
        balance: qbInvoice.Balance,
        payments: payments.map(p => ({ date: p.TxnDate, amount: p.TotalAmt }))
      });
    }

    if (action === 'syncAll') {
      let invoices = await base44.asServiceRole.entities.Invoice.filter({});

      invoices = invoices.filter(invoice => {
        if (!invoice.quickbooks_id) return false;
        if (statusFilter && statusFilter !== 'all' && invoice.status !== statusFilter) return false;
        if (dateFrom && new Date(invoice.issue_date) < new Date(dateFrom)) return false;
        if (dateTo && new Date(invoice.issue_date) > new Date(dateTo)) return false;
        return true;
      });

      const results = [];

      for (const invoice of invoices) {
        try {
          const qbInvoice = await getQBInvoice(accessToken, realmId, invoice.quickbooks_id);
          const payments = await getQBPayments(accessToken, realmId, invoice.quickbooks_id);

          let status = invoice.status;
          let paidDate = null;

          if (qbInvoice.Balance === 0) {
            status = 'paid';
            if (payments.length > 0) {
              const sortedPayments = payments.sort((a, b) => new Date(b.TxnDate) - new Date(a.TxnDate));
              paidDate = sortedPayments[0].TxnDate;
            } else {
              paidDate = new Date().toISOString().split('T')[0];
            }
          } else if (new Date(qbInvoice.DueDate) < new Date()) {
            status = 'overdue';
          } else if (invoice.status === 'created_in_quickbooks' && qbInvoice.EmailStatus !== 'EmailSent') {
            status = 'created_in_quickbooks';
          } else {
            status = 'sent';
          }

          await base44.asServiceRole.entities.Invoice.update(invoice.id, {
            status,
            quickbooks_sync_date: new Date().toISOString(),
            paid_date: paidDate
          });

          results.push({ id: invoice.id, invoice_number: invoice.invoice_number, status, balance: qbInvoice.Balance, paid_date: paidDate, synced: true });
        } catch (error) {
          results.push({ id: invoice.id, invoice_number: invoice.invoice_number, error: error.message, synced: false });
        }
      }

      return Response.json({
        success: true,
        results,
        total: results.length,
        synced: results.filter(r => r.synced).length,
        failed: results.filter(r => !r.synced).length
      });
    }

    if (action === 'listQBInvoices') {
      const query = "SELECT * FROM Invoice MAXRESULTS 1000";
      const response = await fetch(
        `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch invoices: ${errorText}`);
      }

      const result = await response.json();
      const qbInvoices = result.QueryResponse?.Invoice || [];
      const localInvoices = await base44.asServiceRole.entities.Invoice.filter({});

      const enrichedInvoices = qbInvoices.map(qbInv => {
        const localMatch = localInvoices.find(l => l.quickbooks_id === qbInv.Id);
        let status = 'sent';
        if (qbInv.Balance === 0) status = 'paid';
        else if (new Date(qbInv.DueDate) < new Date()) status = 'overdue';
        else if (localMatch?.status === 'created_in_quickbooks' && qbInv.EmailStatus !== 'EmailSent') status = 'created_in_quickbooks';

        const line_items = (qbInv.Line || [])
          .filter(line => line.DetailType === 'SalesItemLineDetail')
          .map(line => ({
            description: line.Description || '',
            quantity: line.SalesItemLineDetail?.Qty || 1,
            rate: line.SalesItemLineDetail?.UnitPrice || 0,
            amount: line.Amount || 0
          }));

        return {
          quickbooks_id: qbInv.Id,
          invoice_number: qbInv.DocNumber,
          customer_name: qbInv.CustomerRef?.name || 'Unknown',
          customer_id: qbInv.CustomerRef?.value,
          total_amount: qbInv.TotalAmt,
          balance: qbInv.Balance,
          issue_date: qbInv.TxnDate,
          due_date: qbInv.DueDate,
          status,
          local_invoice_id: localMatch?.id,
          in_local_db: !!localMatch,
          line_items
        };
      });

      return Response.json({ success: true, invoices: enrichedInvoices, total: enrichedInvoices.length });
    }

    if (action === 'syncClientsFromQB') {
      const customerQuery = "SELECT * FROM Customer MAXRESULTS 1000";
      const customerResponse = await fetch(
        `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(customerQuery)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
      );

      if (!customerResponse.ok) {
        const errorText = await customerResponse.text();
        throw new Error(`Failed to fetch customers: ${errorText}`);
      }

      const customerResult = await customerResponse.json();
      const qbCustomers = customerResult.QueryResponse?.Customer || [];
      const localClients = await base44.asServiceRole.entities.Client.filter({});
      const localInvoices = await base44.asServiceRole.entities.Invoice.filter({});

      const invoiceQuery = "SELECT * FROM Invoice MAXRESULTS 1000";
      const invoiceResponse = await fetch(
        `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(invoiceQuery)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
      );

      if (!invoiceResponse.ok) {
        const errorText = await invoiceResponse.text();
        throw new Error(`Failed to fetch invoices from QuickBooks: ${errorText}`);
      }

      const invoiceResult = await invoiceResponse.json();
      const qbInvoices = invoiceResult.QueryResponse?.Invoice || [];
      const syncResults = [];

      // ── Two-pass domain index (shared builder — mirrors backfillInvoiceClientIds) ──
      // Aliases (email_domain_aliases) are additional keys; collisions between
      // an alias and a primary (or two aliases) are ambiguous exactly like a
      // primary-primary collision. Free-mail/internal domains in aliases are
      // skipped and logged. Records predating the aliases field are safe (|| []).
      const { domainToClient, emailToClient, ambiguousDomains } = buildClientDomainIndex(localClients);

      // ── Fix 6: ignored customer IDs (out-of-scope businesses in the shared QB file) ──
      const ignoredConfig = await base44.asServiceRole.entities.QuickBooksConfig.filter({ key: 'ignored_customer_ids' });
      const ignoredCustomerIds = new Set();
      if (ignoredConfig && ignoredConfig.length > 0) {
        try {
          const ids = JSON.parse(ignoredConfig[0].value);
          if (Array.isArray(ids)) ids.forEach(id => ignoredCustomerIds.add(String(id)));
        } catch { /* malformed config — treat as empty ignore list */ }
      }

      const unmappedCustomers = [];

      for (const qbCustomer of qbCustomers) {
        try {
          // Skip ignored customers entirely (other businesses in the shared QB file)
          if (ignoredCustomerIds.has(String(qbCustomer.Id))) continue;

          const email = qbCustomer.PrimaryEmailAddr?.Address;
          if (!email) continue;

          const customerInvoices = qbInvoices.filter(inv => inv.CustomerRef?.value === qbCustomer.Id);
          const invoiceIds = [];

          // Domain-based matching via the prebuilt unambiguous domain index;
          // fall back to exact email for free-mail / null-domain / ambiguous domains.
          const orgDomain = getOrgDomain(email);
          const emailKey = email.toLowerCase().trim();
          const existingClient = (orgDomain && domainToClient.get(orgDomain)) || emailToClient.get(emailKey);

          for (const qbInv of customerInvoices) {
            let localInvoice = localInvoices.find(inv => inv.quickbooks_id === qbInv.Id);

            const line_items = (qbInv.Line || [])
              .filter(line => line.DetailType === 'SalesItemLineDetail')
              .map(line => ({
                description: line.Description || '',
                quantity: line.SalesItemLineDetail?.Qty || 1,
                rate: line.SalesItemLineDetail?.UnitPrice || 0,
                amount: line.Amount || 0
              }));

            let status = 'sent';
            if (qbInv.Balance === 0) status = 'paid';
            else if (new Date(qbInv.DueDate) < new Date()) status = 'overdue';
            else if (localInvoice?.status === 'created_in_quickbooks' && qbInv.EmailStatus !== 'EmailSent') status = 'created_in_quickbooks';

            const invoiceData = {
              invoice_number: qbInv.DocNumber,
              client_id: existingClient?.id,
              client_name: qbCustomer.DisplayName || email,
              client_email: email,
              company: qbCustomer.CompanyName || '',
              line_items,
              subtotal: qbInv.TotalAmt || 0,
              total_amount: qbInv.TotalAmt || 0,
              status,
              issue_date: qbInv.TxnDate,
              due_date: qbInv.DueDate,
              quickbooks_id: qbInv.Id,
              quickbooks_sync_date: new Date().toISOString(),
              memo: qbInv.CustomerMemo?.value || ''
            };

            if (localInvoice) {
              await base44.asServiceRole.entities.Invoice.update(localInvoice.id, invoiceData);
              invoiceIds.push(localInvoice.id);
            } else {
              const newInvoice = await base44.asServiceRole.entities.Invoice.create(invoiceData);
              invoiceIds.push(newInvoice.id);
            }
          }

          const purchasedServices = new Set();
          customerInvoices.forEach(invoice => {
            (invoice.Line || []).filter(line => line.DetailType === 'SalesItemLineDetail').forEach(line => {
              if (line.Description) purchasedServices.add(line.Description);
            });
          });

          const totalInvoiceValue = customerInvoices.reduce((sum, inv) => sum + (inv.TotalAmt || 0), 0);
          const invoiceCount = customerInvoices.length;

          if (existingClient) {
            const mergedServices = new Set([...(existingClient.purchased_services || []), ...Array.from(purchasedServices)]);
            const mergedInvoiceIds = [...new Set([...(existingClient.invoice_ids || []), ...invoiceIds])];

            // Update payload — QuickBooks may fill a blank, never overwrite
            // something that's already there (except invoice aggregates, for
            // which QB is the source of truth). name is never set: QB
            // DisplayName is frequently the company, not a human contact.
            const qbPhone = qbCustomer.PrimaryPhone?.FreeFormNumber?.trim() || '';
            const qbAddress = qbCustomer.BillAddr
              ? `${qbCustomer.BillAddr.Line1 || ''} ${qbCustomer.BillAddr.City || ''} ${qbCustomer.BillAddr.CountrySubDivisionCode || ''} ${qbCustomer.BillAddr.PostalCode || ''}`.trim()
              : '';
            const qbNotes = qbCustomer.Notes?.trim() || '';

            const updatePayload = {
              email_domain: orgDomain || undefined,
              purchased_services: Array.from(mergedServices),
              total_invoice_value: totalInvoiceValue,
              invoice_count: invoiceCount,
              invoice_ids: mergedInvoiceIds
            };
            // Backfill company only if the existing record has none.
            if (!existingClient.company || !existingClient.company.trim()) {
              updatePayload.company = qbCustomer.CompanyName || deriveCompanyFromEmail(email) || '';
            }
            // Backfill email only if the existing record has none — on a domain
            // match the QB customer's email is often a different person (billing
            // vs. programme contact); never overwrite the contact of record.
            if (!existingClient.email) {
              updatePayload.email = email;
            }
            // Backfill phone / address / notes only when QB has a value AND the
            // existing Base44 field is blank — omitting the key entirely preserves
            // any existing value (partial-merge semantics).
            if (qbPhone && !existingClient.phone) {
              updatePayload.phone = qbPhone;
            }
            if (qbAddress && !existingClient.company_address) {
              updatePayload.company_address = qbAddress;
            }
            if (qbNotes && !existingClient.notes) {
              updatePayload.notes = qbNotes;
            }
            // If the invoice query returned nothing (throttled/failed), do NOT
            // overwrite the client's existing totals with zeros — preserve them.
            if (qbInvoices.length === 0) {
              delete updatePayload.total_invoice_value;
              delete updatePayload.invoice_count;
            }
            await base44.asServiceRole.entities.Client.update(existingClient.id, updatePayload);
            syncResults.push({ email, action: 'updated', client_id: existingClient.id, invoices: invoiceCount, total_value: totalInvoiceValue });
          } else {
            // Fix 5: never auto-create a Client — the shared QB file contains
            // customers from other businesses. Collect for manual review instead.
            unmappedCustomers.push({
              customer_id: qbCustomer.Id,
              display_name: qbCustomer.DisplayName || '',
              email,
              company: qbCustomer.CompanyName || '',
              invoice_count: invoiceCount,
              combined_total: totalInvoiceValue
            });
          }
        } catch (error) {
          syncResults.push({ email: qbCustomer.PrimaryEmailAddr?.Address || 'unknown', action: 'failed', error: error.message });
        }
      }

      return Response.json({
        success: true,
        results: syncResults,
        total: syncResults.length,
        updated: syncResults.filter(r => r.action === 'updated').length,
        failed: syncResults.filter(r => r.action === 'failed').length,
        unmapped_customers: unmappedCustomers,
        unmapped_count: unmappedCustomers.length,
        ambiguous_domains: ambiguousDomains
      });
    }

    if (action === 'deleteInvoice') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];
      if (invoiceData.quickbooks_id) {
        try {
          const qbInvoice = await getQBInvoice(accessToken, realmId, invoiceData.quickbooks_id);
          const deleteUrl = `${QB_API_URL}/${realmId}/invoice?operation=delete`;
          const deleteResponse = await fetch(deleteUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ Id: invoiceData.quickbooks_id, SyncToken: qbInvoice.SyncToken })
          });

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            let errorMsg = 'Failed to delete from QuickBooks';
            try {
              const errorData = JSON.parse(errorText);
              const qbError = errorData.Fault?.Error?.[0];
              errorMsg = qbError?.Detail || qbError?.Message || errorMsg;
              console.error('QuickBooks delete error:', JSON.stringify(errorData));
            } catch {
              errorMsg = errorText;
              console.error('QuickBooks delete raw error:', errorText);
            }
            // QB is source of truth — abort local deletion to avoid divergence
            return Response.json(
              { error: `QuickBooks deletion failed: ${errorMsg}. The local invoice was not deleted.` },
              { status: 502 }
            );
          }
        } catch (error) {
          console.error('QB delete exception:', error.message);
          return Response.json(
            { error: `QuickBooks deletion failed: ${error.message}. The local invoice was not deleted.` },
            { status: 502 }
          );
        }
      }

      await base44.asServiceRole.entities.Invoice.delete(invoiceId);

      return Response.json({
        success: true,
        message: 'Invoice deleted successfully'
      });
    }

    if (action === 'markAsPaid') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];
      const paidDate = new Date().toISOString().split('T')[0];

      // If synced to QB, record a payment there too
      if (invoiceData.quickbooks_id) {
        try {
          const qbInvoice = await getQBInvoice(accessToken, realmId, invoiceData.quickbooks_id);

          // Only record payment if there's still a balance
          if (qbInvoice.Balance > 0) {
            const paymentPayload = {
              TotalAmt: qbInvoice.Balance,
              CustomerRef: qbInvoice.CustomerRef,
              TxnDate: paidDate,
              Line: [{
                Amount: qbInvoice.Balance,
                LinkedTxn: [{ TxnId: invoiceData.quickbooks_id, TxnType: 'Invoice' }]
              }]
            };

            const paymentResponse = await fetch(`${QB_API_URL}/${realmId}/payment`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(paymentPayload)
            });

            if (!paymentResponse.ok) {
              const errorText = await paymentResponse.text();
              let errorMsg = 'Failed to record payment in QuickBooks';
              try {
                const errorData = JSON.parse(errorText);
                const qbError = errorData.Fault?.Error?.[0];
                errorMsg = qbError?.Detail || qbError?.Message || errorMsg;
                console.error('QB payment error:', JSON.stringify(errorData));
              } catch {
                errorMsg = errorText;
              }
              // QB is source of truth — abort local update to avoid divergence
              return Response.json(
                { error: `QuickBooks payment failed: ${errorMsg}. The local invoice was not marked as paid.` },
                { status: 502 }
              );
            }
          }
        } catch (error) {
          console.error('QB mark paid exception:', error.message);
          return Response.json(
            { error: `QuickBooks payment failed: ${error.message}. The local invoice was not marked as paid.` },
            { status: 502 }
          );
        }
      }

      await base44.asServiceRole.entities.Invoice.update(invoiceId, {
        status: 'paid',
        paid_date: paidDate
      });

      return Response.json({
        success: true,
        paid_date: paidDate,
        message: 'Invoice marked as paid successfully'
      });
    }

    if (action === 'buildFromInvoice') {
      // Dry-run: builds the invoice body from an Invoice's line_items
      // without POSTing to QuickBooks. Used to verify the Invoice adapter
      // produces the same body shape as the Proposal adapter.
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }
      const invoiceData = invoice[0];
      if (!invoiceData.line_items || invoiceData.line_items.length === 0) {
        return Response.json({ error: 'Invoice has no line items' }, { status: 400 });
      }

      const allServices = await base44.asServiceRole.entities.Service.list('name', 500);
      const serviceMap = new Map(allServices.map(s => [s.id, s]));

      const { lines, warnings: lineWarnings } = linesFromInvoice(invoiceData.line_items, allServices);

      const { body: invoiceBody, lineAnalysis, blockingErrors, warnings } = buildInvoiceBody({
        customerId: 'DRY_RUN_PLACEHOLDER',
        customerEmail: invoiceData.client_email || 'unknown',
        txnDate: invoiceData.issue_date || new Date().toISOString().split('T')[0],
        lines,
        memo: invoiceData.memo,
        docNumber: invoiceData.invoice_number,
        serviceMap,
      });

      return Response.json({
        dry_run: true,
        invoice_id: invoiceId,
        invoice_number: invoiceData.invoice_number,
        invoice_body: invoiceBody,
        line_analysis: lineAnalysis,
        blocking_errors: blockingErrors,
        warnings: [...warnings, ...lineWarnings],
        line_count: lines.length,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});