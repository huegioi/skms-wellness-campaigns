import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const accessToken = Deno.env.get('Quickbooks_ACCESS_TOKEN');
    const realmId = Deno.env.get('QUICKBOOK_REALM_ID');

    if (!accessToken || !realmId) {
      return Response.json({ error: 'QuickBooks credentials not configured' }, { status: 500 });
    }

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
      expenses.push({
        quickbooks_id: purchase.Id,
        transaction_date: purchase.TxnDate,
        vendor_name: purchase.EntityRef?.name || 'Unknown',
        amount: purchase.TotalAmt || 0,
        description: purchase.PrivateNote || '',
        payment_method: purchase.PaymentMethodRef?.name || '',
        transaction_type: 'Purchase',
        account_name: purchase.AccountRef?.name || ''
      });
    });

    bills.forEach(bill => {
      expenses.push({
        quickbooks_id: bill.Id,
        transaction_date: bill.TxnDate,
        vendor_name: bill.VendorRef?.name || 'Unknown',
        amount: bill.TotalAmt || 0,
        description: bill.PrivateNote || '',
        transaction_type: 'Bill',
        account_name: bill.APAccountRef?.name || ''
      });
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