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
    const errorText = await response.text();
    let errorMsg = 'Failed to refresh token';
    try {
      const errorData = JSON.parse(errorText);
      errorMsg = errorData.error_description || errorData.error || errorMsg;
    } catch {
      errorMsg = errorText;
    }
    throw new Error(errorMsg);
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
      const payments = await getQBPayments(accessToken, realmId, invoiceData.quickbooks_id);

      // Update status based on QB balance
      let status = invoiceData.status;
      let paidDate = null;
      
      if (qbInvoice.Balance === 0) {
        status = 'paid';
        // Get the most recent payment date
        if (payments.length > 0) {
          const sortedPayments = payments.sort((a, b) => 
            new Date(b.TxnDate) - new Date(a.TxnDate)
          );
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
        payments: payments.map(p => ({
          date: p.TxnDate,
          amount: p.TotalAmt
        }))
      });
    }

    if (action === 'syncAll') {
      let invoices = await base44.asServiceRole.entities.Invoice.filter({});
      
      // Apply filters
      invoices = invoices.filter(invoice => {
        // Only sync invoices with QuickBooks ID
        if (!invoice.quickbooks_id) return false;
        
        // Filter by status if provided
        if (statusFilter && statusFilter !== 'all' && invoice.status !== statusFilter) {
          return false;
        }
        
        // Filter by date range if provided
        if (dateFrom && new Date(invoice.issue_date) < new Date(dateFrom)) {
          return false;
        }
        if (dateTo && new Date(invoice.issue_date) > new Date(dateTo)) {
          return false;
        }
        
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
              const sortedPayments = payments.sort((a, b) => 
                new Date(b.TxnDate) - new Date(a.TxnDate)
              );
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

          results.push({ 
            id: invoice.id, 
            invoice_number: invoice.invoice_number,
            status, 
            balance: qbInvoice.Balance,
            paid_date: paidDate,
            synced: true 
          });
        } catch (error) {
          results.push({ 
            id: invoice.id, 
            invoice_number: invoice.invoice_number,
            error: error.message, 
            synced: false 
          });
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
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch invoices: ${errorText}`);
      }

      const result = await response.json();
      const qbInvoices = result.QueryResponse?.Invoice || [];

      // Get local invoices to match
      const localInvoices = await base44.asServiceRole.entities.Invoice.filter({});
      
      // Enrich QB invoices with local match info
      const enrichedInvoices = qbInvoices.map(qbInv => {
        const localMatch = localInvoices.find(l => l.quickbooks_id === qbInv.Id);
        
        let status = 'sent';
        if (qbInv.Balance === 0) {
          status = 'paid';
        } else if (new Date(qbInv.DueDate) < new Date()) {
          status = 'overdue';
        }

        return {
          quickbooks_id: qbInv.Id,
          invoice_number: qbInv.DocNumber,
          customer_name: qbInv.CustomerRef?.name || 'Unknown',
          total_amount: qbInv.TotalAmt,
          balance: qbInv.Balance,
          issue_date: qbInv.TxnDate,
          due_date: qbInv.DueDate,
          status,
          local_invoice_id: localMatch?.id,
          in_local_db: !!localMatch
        };
      });

      return Response.json({
        success: true,
        invoices: enrichedInvoices,
        total: enrichedInvoices.length
      });
    }

    if (action === 'deleteInvoice') {
      const invoice = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      if (!invoice || invoice.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoice[0];

      // Delete from QuickBooks if it exists there
      if (invoiceData.quickbooks_id) {
        const qbInvoice = await getQBInvoice(accessToken, realmId, invoiceData.quickbooks_id);
        
        const deleteData = {
          Id: invoiceData.quickbooks_id,
          SyncToken: qbInvoice.SyncToken
        };

        const response = await fetch(
          `${QB_API_URL}/${realmId}/invoice?operation=delete`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(deleteData)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          let errorMsg = 'Failed to delete from QuickBooks';
          try {
            const errorData = JSON.parse(errorText);
            errorMsg = errorData.Fault?.Error?.[0]?.Message || errorMsg;
          } catch {
            errorMsg = errorText;
          }
          throw new Error(errorMsg);
        }
      }

      // Delete from local database
      await base44.asServiceRole.entities.Invoice.delete(invoiceId);

      return Response.json({
        success: true,
        deleted_from_qb: !!invoiceData.quickbooks_id
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});