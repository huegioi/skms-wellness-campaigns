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
      Description: item.description || 'Service',
      SalesItemLineDetail: {
        Qty: item.quantity || 1,
        UnitPrice: item.rate || 0
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

          // Extract line items
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

        return Response.json({
          success: true,
          invoices: enrichedInvoices,
          total: enrichedInvoices.length
        });
      }

      if (action === 'syncClientsFromQB') {
        // Fetch all QB customers
        const customerQuery = "SELECT * FROM Customer MAXRESULTS 1000";
        const customerResponse = await fetch(
          `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(customerQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!customerResponse.ok) {
          const errorText = await customerResponse.text();
          throw new Error(`Failed to fetch customers: ${errorText}`);
        }

        const customerResult = await customerResponse.json();
        const qbCustomers = customerResult.QueryResponse?.Customer || [];

        // Get local clients and invoices
        const localClients = await base44.asServiceRole.entities.Client.filter({});
        const localInvoices = await base44.asServiceRole.entities.Invoice.filter({});

        // Fetch invoices to determine purchased services
        const invoiceQuery = "SELECT * FROM Invoice MAXRESULTS 1000";
        const invoiceResponse = await fetch(
          `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(invoiceQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        );

        const invoiceResult = await invoiceResponse.json();
        const qbInvoices = invoiceResult.QueryResponse?.Invoice || [];

        const syncResults = [];

        for (const qbCustomer of qbCustomers) {
          try {
            const email = qbCustomer.PrimaryEmailAddr?.Address;
            if (!email) continue;

            // Find customer's invoices
            const customerInvoices = qbInvoices.filter(
              inv => inv.CustomerRef?.value === qbCustomer.Id
            );

            // Sync QB invoices to local database
            const invoiceIds = [];
            for (const qbInv of customerInvoices) {
              // Check if invoice already exists locally
              let localInvoice = localInvoices.find(inv => inv.quickbooks_id === qbInv.Id);

              // Extract line items
              const line_items = (qbInv.Line || [])
                .filter(line => line.DetailType === 'SalesItemLineDetail')
                .map(line => ({
                  description: line.Description || '',
                  quantity: line.SalesItemLineDetail?.Qty || 1,
                  rate: line.SalesItemLineDetail?.UnitPrice || 0,
                  amount: line.Amount || 0
                }));

              // Determine status
              let status = 'sent';
              if (qbInv.Balance === 0) {
                status = 'paid';
              } else if (new Date(qbInv.DueDate) < new Date()) {
                status = 'overdue';
              }

              const invoiceData = {
                invoice_number: qbInv.DocNumber,
                client_name: qbCustomer.DisplayName || email,
                client_email: email,
                company: qbCustomer.CompanyName || '',
                line_items: line_items,
                subtotal: qbInv.TotalAmt || 0,
                total_amount: qbInv.TotalAmt || 0,
                status: status,
                issue_date: qbInv.TxnDate,
                due_date: qbInv.DueDate,
                quickbooks_id: qbInv.Id,
                quickbooks_sync_date: new Date().toISOString(),
                memo: qbInv.CustomerMemo?.value || ''
              };

              if (localInvoice) {
                // Update existing invoice
                await base44.asServiceRole.entities.Invoice.update(localInvoice.id, invoiceData);
                invoiceIds.push(localInvoice.id);
              } else {
                // Create new invoice
                const newInvoice = await base44.asServiceRole.entities.Invoice.create(invoiceData);
                invoiceIds.push(newInvoice.id);
              }
            }

            // Extract purchased services from line items
            const purchasedServices = new Set();
            customerInvoices.forEach(invoice => {
              (invoice.Line || [])
                .filter(line => line.DetailType === 'SalesItemLineDetail')
                .forEach(line => {
                  if (line.Description) {
                    purchasedServices.add(line.Description);
                  }
                });
            });

            // Calculate total invoice value and count
            const totalInvoiceValue = customerInvoices.reduce((sum, inv) => sum + (inv.TotalAmt || 0), 0);
            const invoiceCount = customerInvoices.length;

            // Check if client exists
            const existingClient = localClients.find(c => 
              c.email?.toLowerCase() === email.toLowerCase()
            );

            const clientData = {
              name: qbCustomer.DisplayName || 
                    `${qbCustomer.GivenName || ''} ${qbCustomer.FamilyName || ''}`.trim() ||
                    email,
              email: email,
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
              // Update existing client - merge purchased services and invoice IDs
              const mergedServices = new Set([
                ...(existingClient.purchased_services || []),
                ...clientData.purchased_services
              ]);

              const mergedInvoiceIds = [...new Set([
                ...(existingClient.invoice_ids || []),
                ...clientData.invoice_ids
              ])];

              await base44.asServiceRole.entities.Client.update(existingClient.id, {
                ...clientData,
                purchased_services: Array.from(mergedServices),
                invoice_ids: mergedInvoiceIds
              });

              syncResults.push({
                email,
                action: 'updated',
                client_id: existingClient.id,
                invoices: invoiceCount,
                total_value: totalInvoiceValue
              });
            } else {
              // Create new client
              const newClient = await base44.asServiceRole.entities.Client.create(clientData);
              syncResults.push({
                email,
                action: 'created',
                client_id: newClient.id,
                invoices: invoiceCount,
                total_value: totalInvoiceValue
              });
            }
          } catch (error) {
            syncResults.push({
              email: qbCustomer.PrimaryEmailAddr?.Address || 'unknown',
              action: 'failed',
              error: error.message
            });
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

      // If synced to QuickBooks, delete from QB first
      if (invoiceData.quickbooks_id) {
        try {
          // Get the invoice to get SyncToken
          const qbInvoice = await getQBInvoice(accessToken, realmId, invoiceData.quickbooks_id);
          
          // Delete from QuickBooks
          const deleteUrl = `${QB_API_URL}/${realmId}/invoice?operation=delete`;
          const deleteResponse = await fetch(deleteUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              Id: invoiceData.quickbooks_id,
              SyncToken: qbInvoice.SyncToken
            })
          });

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            let errorMsg = 'Failed to delete from QuickBooks';
            try {
              const errorData = JSON.parse(errorText);
              errorMsg = errorData.Fault?.Error?.[0]?.Message || errorMsg;
            } catch {
              errorMsg = errorText;
            }
            throw new Error(errorMsg);
          }
        } catch (error) {
          return Response.json({ 
            error: `Failed to delete from QuickBooks: ${error.message}` 
          }, { status: 500 });
        }
      }

      // Delete from local database
      await base44.asServiceRole.entities.Invoice.delete(invoiceId);

      return Response.json({
        success: true,
        message: 'Invoice deleted successfully'
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});