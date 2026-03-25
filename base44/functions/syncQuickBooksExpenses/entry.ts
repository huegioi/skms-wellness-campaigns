import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshAccessToken() {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  const refreshToken = Deno.env.get('QUICKBOOKS_REFRSH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('QuickBooks OAuth credentials not configured');
  }

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const realmId = Deno.env.get('QUICKBOOK_REALM_ID');

    if (!realmId) {
      return Response.json({ error: 'QuickBooks realm ID not configured' }, { status: 500 });
    }

    // Get fresh access token
    const accessToken = await refreshAccessToken();

    // Fetch expenses (Purchase transactions)
    const purchaseResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Purchase MAXRESULTS 1000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!purchaseResponse.ok) {
      throw new Error(`QuickBooks API error: ${purchaseResponse.statusText}`);
    }

    const purchaseData = await purchaseResponse.json();
    const purchases = purchaseData.QueryResponse?.Purchase || [];

    // Fetch bills
    const billResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Bill MAXRESULTS 1000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const billData = await billResponse.json();
    const bills = billData.QueryResponse?.Bill || [];

    // Transform and combine expenses
    const expenses = [];

    purchases.forEach(purchase => {
      // Extract line item details for better categorization
      const lineItems = purchase.Line || [];
      
      lineItems.forEach(line => {
        if (line.DetailType === 'AccountBasedExpenseLineDetail') {
          const detail = line.AccountBasedExpenseLineDetail;
          expenses.push({
            quickbooks_id: `${purchase.Id}-${line.Id}`,
            transaction_date: purchase.TxnDate,
            vendor_name: purchase.EntityRef?.name || 'Unknown',
            amount: line.Amount || 0,
            description: line.Description || purchase.PrivateNote || '',
            payment_method: purchase.PaymentMethodRef?.name || '',
            transaction_type: 'Purchase',
            account_name: detail?.AccountRef?.name || purchase.AccountRef?.name || '',
            account_type: detail?.AccountRef?.type || '',
            category: detail?.AccountRef?.name || 'Uncategorized'
          });
        }
      });

      // If no line items, add the purchase as a single expense
      if (lineItems.length === 0) {
        expenses.push({
          quickbooks_id: purchase.Id,
          transaction_date: purchase.TxnDate,
          vendor_name: purchase.EntityRef?.name || 'Unknown',
          amount: purchase.TotalAmt || 0,
          description: purchase.PrivateNote || '',
          payment_method: purchase.PaymentMethodRef?.name || '',
          transaction_type: 'Purchase',
          account_name: purchase.AccountRef?.name || '',
          category: purchase.AccountRef?.name || 'Uncategorized'
        });
      }
    });

    bills.forEach(bill => {
      // Extract line item details for bills
      const lineItems = bill.Line || [];
      
      lineItems.forEach(line => {
        if (line.DetailType === 'AccountBasedExpenseLineDetail') {
          const detail = line.AccountBasedExpenseLineDetail;
          expenses.push({
            quickbooks_id: `${bill.Id}-${line.Id}`,
            transaction_date: bill.TxnDate,
            vendor_name: bill.VendorRef?.name || 'Unknown',
            amount: line.Amount || 0,
            description: line.Description || bill.PrivateNote || '',
            transaction_type: 'Bill',
            account_name: detail?.AccountRef?.name || bill.APAccountRef?.name || '',
            account_type: detail?.AccountRef?.type || '',
            category: detail?.AccountRef?.name || 'Uncategorized'
          });
        } else if (line.DetailType === 'ItemBasedExpenseLineDetail') {
          const detail = line.ItemBasedExpenseLineDetail;
          expenses.push({
            quickbooks_id: `${bill.Id}-${line.Id}`,
            transaction_date: bill.TxnDate,
            vendor_name: bill.VendorRef?.name || 'Unknown',
            amount: line.Amount || 0,
            description: line.Description || detail?.ItemRef?.name || bill.PrivateNote || '',
            transaction_type: 'Bill',
            account_name: bill.APAccountRef?.name || '',
            category: detail?.ItemRef?.name || 'Uncategorized'
          });
        }
      });

      // If no line items, add the bill as a single expense
      if (lineItems.length === 0) {
        expenses.push({
          quickbooks_id: bill.Id,
          transaction_date: bill.TxnDate,
          vendor_name: bill.VendorRef?.name || 'Unknown',
          amount: bill.TotalAmt || 0,
          description: bill.PrivateNote || '',
          transaction_type: 'Bill',
          account_name: bill.APAccountRef?.name || '',
          category: 'Uncategorized'
        });
      }
    });

    // Delete existing expenses and insert new ones
    const existingExpenses = await base44.asServiceRole.entities.QuickBooksExpense.list();
    for (const expense of existingExpenses) {
      await base44.asServiceRole.entities.QuickBooksExpense.delete(expense.id);
    }

    if (expenses.length > 0) {
      await base44.asServiceRole.entities.QuickBooksExpense.bulkCreate(expenses);
    }

    return Response.json({
      success: true,
      synced: expenses.length,
      message: `Synced ${expenses.length} expense transactions`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});