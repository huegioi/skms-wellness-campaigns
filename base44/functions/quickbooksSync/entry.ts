import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

async function findQBCustomer(accessToken, realmId, email) {
  const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`;
  const response = await fetch(
    `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) return null;

  const result = await response.json();
  return result.QueryResponse?.Customer?.[0]?.Id || null;
}

async function createQBInvoice(accessToken, realmId, invoiceData, customerId) {
  const qbInvoice = {
    CustomerRef: { value: customerId },
    TxnDate: invoiceData.issue_date,
    DueDate: invoiceData.due_date,
    Line: invoiceData.line_items.map((item) => {
      const lineDetail = {
        DetailType: 'SalesItemLineDetail',
        Amount: item.amount,
        Description: item.name || item.description || 'Service',
        SalesItemLineDetail: {
          Qty: item.quantity || 1,
          UnitPrice: item.rate || 0
        }
      };
      if (item.quickbooks_item_id) {
        lineDetail.SalesItemLineDetail.ItemRef = { value: item.quickbooks_item_id };
      }
      return lineDetail;
    }),
    CustomerMemo: invoiceData.memo ? { value: invoiceData.memo } : undefined
  };

  const response = await fetch(`${QB_API_URL}/${realmId}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(qbInvoice)
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

      let customerId = await findQBCustomer(accessToken, realmId, invoiceData.client_email);
      if (!customerId) {
        customerId = await createQBCustomer(accessToken, realmId, invoiceData);
      }

      const qbInvoice = await createQBInvoice(accessToken, realmId, invoiceData, customerId);

      await base44.asServiceRole.entities.Invoice.update(invoiceId, {
        quickbooks_id: qbInvoice.Id,
        quickbooks_sync_date: new Date().toISOString(),
        status: 'sent'
      });

      return Response.json({
        success: true,
        quickbooks_id: qbInvoice.Id,
        invoice_number: qbInvoice.DocNumber
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

      for (const qbCustomer of qbCustomers) {
        try {
          const email = qbCustomer.PrimaryEmailAddr?.Address;
          if (!email) continue;

          const customerInvoices = qbInvoices.filter(inv => inv.CustomerRef?.value === qbCustomer.Id);
          const invoiceIds = [];

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

            const invoiceData = {
              invoice_number: qbInv.DocNumber,
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
          const existingClient = localClients.find(c => c.email?.toLowerCase() === email.toLowerCase());

          const clientData = {
            name: qbCustomer.DisplayName || `${qbCustomer.GivenName || ''} ${qbCustomer.FamilyName || ''}`.trim() || email,
            email,
            company: qbCustomer.CompanyName || '',
            phone: qbCustomer.PrimaryPhone?.FreeFormNumber || '',
            company_address: qbCustomer.BillAddr ?
              `${qbCustomer.BillAddr.Line1 || ''} ${qbCustomer.BillAddr.City || ''} ${qbCustomer.BillAddr.CountrySubDivisionCode || ''} ${qbCustomer.BillAddr.PostalCode || ''}`.trim() : '',
            notes: qbCustomer.Notes || '',
            purchased_services: Array.from(purchasedServices),
            total_invoice_value: totalInvoiceValue,
            invoice_count: invoiceCount,
            invoice_ids: invoiceIds
          };

          if (existingClient) {
            const mergedServices = new Set([...(existingClient.purchased_services || []), ...clientData.purchased_services]);
            const mergedInvoiceIds = [...new Set([...(existingClient.invoice_ids || []), ...clientData.invoice_ids])];
            const updatePayload = {
              ...clientData,
              purchased_services: Array.from(mergedServices),
              invoice_ids: mergedInvoiceIds
            };
            // If the invoice query returned nothing (throttled/failed), do NOT
            // overwrite the client's existing totals with zeros — preserve them.
            if (qbInvoices.length === 0) {
              delete updatePayload.total_invoice_value;
              delete updatePayload.invoice_count;
            }
            await base44.asServiceRole.entities.Client.update(existingClient.id, updatePayload);
            syncResults.push({ email, action: 'updated', client_id: existingClient.id, invoices: invoiceCount, total_value: totalInvoiceValue });
          } else {
            const newClient = await base44.asServiceRole.entities.Client.create(clientData);
            syncResults.push({ email, action: 'created', client_id: newClient.id, invoices: invoiceCount, total_value: totalInvoiceValue });
          }
        } catch (error) {
          syncResults.push({ email: qbCustomer.PrimaryEmailAddr?.Address || 'unknown', action: 'failed', error: error.message });
        }
      }

      return Response.json({
        success: true,
        results: syncResults,
        total: syncResults.length,
        created: syncResults.filter(r => r.action === 'created').length,
        updated: syncResults.filter(r => r.action === 'updated').length,
        failed: syncResults.filter(r => r.action === 'failed').length
      });
    }

    if (action === 'deleteInvoice') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];
      let qbWarning = null;

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
            // Don't block local deletion — just warn
            qbWarning = errorMsg;
          }
        } catch (error) {
          console.error('QB delete exception:', error.message);
          qbWarning = error.message;
        }
      }

      await base44.asServiceRole.entities.Invoice.delete(invoiceId);

      return Response.json({
        success: true,
        message: qbWarning
          ? `Invoice deleted locally. QuickBooks warning: ${qbWarning}`
          : 'Invoice deleted successfully',
        qb_warning: qbWarning
      });
    }

    if (action === 'markAsPaid') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];
      const paidDate = new Date().toISOString().split('T')[0];
      let qbWarning = null;

      // If synced to QB, record a payment there too
      if (invoiceData.quickbooks_id) {
        try {
          const qbInvoice = await getQBInvoice(accessToken, realmId, invoiceData.quickbooks_id);

          // Only record payment if there's still a balance
          if (qbInvoice.Balance > 0) {
            // Find or create an AR account reference (QuickBooks requires it)
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
              qbWarning = errorMsg;
            }
          }
        } catch (error) {
          console.error('QB mark paid exception:', error.message);
          qbWarning = error.message;
        }
      }

      // Always update local record
      await base44.asServiceRole.entities.Invoice.update(invoiceId, {
        status: 'paid',
        paid_date: paidDate
      });

      return Response.json({
        success: true,
        paid_date: paidDate,
        message: qbWarning
          ? `Marked as paid locally. QuickBooks warning: ${qbWarning}`
          : 'Invoice marked as paid successfully',
        qb_warning: qbWarning
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});