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

    // Fetch payments
    const paymentResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Payment MAXRESULTS 1000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      throw new Error(`QuickBooks Payment API error: ${paymentResponse.status} - ${errorText}`);
    }

    const paymentData = await paymentResponse.json();
    const payments = paymentData.QueryResponse?.Payment || [];

    // Fetch sales receipts
    const salesResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM SalesReceipt MAXRESULTS 1000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    // Sales receipts may not exist, so handle gracefully
    let salesReceipts = [];
    if (salesResponse.ok) {
      const salesData = await salesResponse.json();
      salesReceipts = salesData.QueryResponse?.SalesReceipt || [];
    }

    // Transform and combine income
    const incomeTransactions = [];

    payments.forEach(payment => {
      incomeTransactions.push({
        quickbooks_id: payment.Id,
        transaction_date: payment.TxnDate,
        customer_name: payment.CustomerRef?.name || 'Unknown',
        amount: payment.TotalAmt || 0,
        description: payment.PrivateNote || '',
        payment_method: payment.PaymentMethodRef?.name || '',
        transaction_type: 'Payment',
        deposit_account: payment.DepositToAccountRef?.name || ''
      });
    });

    salesReceipts.forEach(receipt => {
      incomeTransactions.push({
        quickbooks_id: receipt.Id,
        transaction_date: receipt.TxnDate,
        customer_name: receipt.CustomerRef?.name || 'Unknown',
        amount: receipt.TotalAmt || 0,
        description: receipt.PrivateNote || '',
        payment_method: receipt.PaymentMethodRef?.name || '',
        transaction_type: 'Sales Receipt',
        deposit_account: receipt.DepositToAccountRef?.name || ''
      });
    });

    // Delete existing income and insert new ones
    const existingIncome = await base44.asServiceRole.entities.QuickBooksIncome.list();
    for (const income of existingIncome) {
      await base44.asServiceRole.entities.QuickBooksIncome.delete(income.id);
    }

    if (incomeTransactions.length > 0) {
      await base44.asServiceRole.entities.QuickBooksIncome.bulkCreate(incomeTransactions);
    }

    return Response.json({
      success: true,
      synced: incomeTransactions.length,
      message: `Synced ${incomeTransactions.length} income transactions`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});