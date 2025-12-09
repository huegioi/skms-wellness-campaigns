import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const QB_API_URL = 'https://quickbooks.api.intuit.com/v3/company';

async function refreshAccessToken() {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  const refreshToken = Deno.env.get('QUICKBOOKS_REFRSH_TOKEN');

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
    throw new Error(`Failed to refresh token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
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
    throw new Error(`Failed to create customer: ${await response.text()}`);
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
    Line: invoiceData.line_items.map((item, idx) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: item.amount,
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.rate
      }
    })),
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
    throw new Error(`Failed to create invoice: ${await response.text()}`);
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
    throw new Error(`Failed to get invoice: ${await response.text()}`);
  }

  const result = await response.json();
  return result.Invoice;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, invoiceId } = await req.json();
    const realmId = Deno.env.get('QUICKBOOK_REALM_ID');

    if (!realmId) {
      return Response.json({ error: 'QuickBooks not configured' }, { status: 500 });
    }

    const accessToken = await refreshAccessToken();

    if (action === 'createInvoice') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];

      // Find or create customer
      let customerId = await findQBCustomer(accessToken, realmId, invoiceData.client_email);
      if (!customerId) {
        customerId = await createQBCustomer(accessToken, realmId, invoiceData);
      }

      // Create invoice in QuickBooks
      const qbInvoice = await createQBInvoice(accessToken, realmId, invoiceData, customerId);

      // Update local invoice with QB ID
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

      // Get latest from QuickBooks
      const qbInvoice = await getQBInvoice(accessToken, realmId, invoiceData.quickbooks_id);

      // Update status based on QB balance
      let status = invoiceData.status;
      if (qbInvoice.Balance === 0) {
        status = 'paid';
      } else if (new Date(qbInvoice.DueDate) < new Date()) {
        status = 'overdue';
      } else {
        status = 'sent';
      }

      await base44.asServiceRole.entities.Invoice.update(invoiceId, {
        status,
        quickbooks_sync_date: new Date().toISOString(),
        paid_date: qbInvoice.Balance === 0 ? new Date().toISOString() : null
      });

      return Response.json({
        success: true,
        status,
        balance: qbInvoice.Balance
      });
    }

    if (action === 'syncAll') {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({});
      const results = [];

      for (const invoice of invoices) {
        if (invoice.quickbooks_id) {
          try {
            const qbInvoice = await getQBInvoice(accessToken, realmId, invoice.quickbooks_id);
            let status = invoice.status;
            if (qbInvoice.Balance === 0) {
              status = 'paid';
            } else if (new Date(qbInvoice.DueDate) < new Date()) {
              status = 'overdue';
            } else {
              status = 'sent';
            }

            await base44.asServiceRole.entities.Invoice.update(invoice.id, {
              status,
              quickbooks_sync_date: new Date().toISOString()
            });

            results.push({ id: invoice.id, status, synced: true });
          } catch (error) {
            results.push({ id: invoice.id, error: error.message, synced: false });
          }
        }
      }

      return Response.json({ success: true, results });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});