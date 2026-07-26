import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, QB_API_URL } from '../../shared/quickbooksAuth.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'invoice_dry_run';

    const { accessToken, tokenRotated } = await getAccessToken(base44);
    const realmId = await getRealmId(base44);

    async function qbQuery(sql: string): Promise<any> {
      const resp = await fetch(`${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(sql)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
      });
      if (!resp.ok) throw new Error(`QB query failed (${resp.status}): ${(await resp.text()).substring(0, 300)}`);
      return resp.json();
    }

    // ── MODE: customer_search ──
    if (mode === 'customer_search') {
      const searchTerm = body.search_term || '';
      if (!searchTerm) return Response.json({ error: 'search_term required' }, { status: 400 });

      const custSql = `SELECT * FROM Customer WHERE DisplayName LIKE '%${searchTerm}%' OR CompanyName LIKE '%${searchTerm}%' OR GivenName LIKE '%${searchTerm}%' OR FamilyName LIKE '%${searchTerm}%' OR PrintOnCheckName LIKE '%${searchTerm}%' MAXRESULTS 100`;
      const custData = await qbQuery(custSql);
      const customers = custData.QueryResponse?.Customer || [];

      const allAppInvoices = await base44.asServiceRole.entities.Invoice.list('-issue_date', 1000);
      const appQbIdMap = new Map();
      for (const inv of allAppInvoices) {
        if (inv.quickbooks_id) appQbIdMap.set(inv.quickbooks_id, inv);
      }

      const results = [];
      for (const cust of customers) {
        const invSql = `SELECT * FROM Invoice WHERE CustomerRef = '${cust.Id}' ORDER BY TxnDate DESC MAXRESULTS 500`;
        const invData = await qbQuery(invSql);
        const qbInvoices = invData.QueryResponse?.Invoice || [];

        const invoices = qbInvoices.map((qi: any) => {
          const appInv = appQbIdMap.get(qi.Id);
          return {
            qb_id: qi.Id,
            doc_number: qi.DocNumber,
            txn_date: qi.TxnDate,
            due_date: qi.DueDate,
            total_amt: parseFloat(qi.TotalAmt || '0'),
            balance: parseFloat(qi.Balance || '0'),
            is_paid: parseFloat(qi.Balance || '0') === 0,
            has_app_record: !!appInv,
            app_invoice_id: appInv?.id || null,
            app_status: appInv?.status || null,
            app_out_of_scope: appInv?.out_of_scope || false,
          };
        });

        results.push({
          customer: {
            id: cust.Id,
            display_name: cust.DisplayName,
            company_name: cust.CompanyName,
            print_on_check_name: cust.PrintOnCheckName,
            email: cust.PrimaryEmailAddr?.Address,
            active: cust.Active,
          },
          invoice_count: invoices.length,
          total_amount: invoices.reduce((s: number, i: any) => s + i.total_amt, 0),
          open_balance: invoices.reduce((s: number, i: any) => s + i.balance, 0),
          in_app_count: invoices.filter((i: any) => i.has_app_record).length,
          invoices,
        });
      }

      return Response.json({
        success: true,
        token_rotated: tokenRotated,
        search_term: searchTerm,
        customers_found: results.length,
        results,
      });
    }

    // ── MODE: missing_invoices ──
    if (mode === 'missing_invoices') {
      const ignoredConfigs = await base44.asServiceRole.entities.QuickBooksConfig.filter({ key: 'ignored_customer_ids' });
      let ignoredCustomerIds: string[] = [];
      if (ignoredConfigs.length > 0) {
        try { ignoredCustomerIds = JSON.parse(ignoredConfigs[0].value); } catch {}
      }

      const allAppInvoices = await base44.asServiceRole.entities.Invoice.list('-issue_date', 1000);
      const appQbIdSet = new Set(allAppInvoices.filter((i: any) => i.quickbooks_id).map((i: any) => i.quickbooks_id));

      let allQbInvoices: any[] = [];
      let startPosition = 1;
      const pageSize = 1000;

      while (true) {
        const sql = `SELECT Id, DocNumber, TxnDate, DueDate, TotalAmt, Balance, CustomerRef FROM Invoice STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
        const data = await qbQuery(sql);
        const batch = data.QueryResponse?.Invoice || [];
        allQbInvoices = allQbInvoices.concat(batch);
        if (batch.length < pageSize) break;
        startPosition += pageSize;
      }

      const missing = [];
      for (const qi of allQbInvoices) {
        if (appQbIdSet.has(qi.Id)) continue;
        const balance = parseFloat(qi.Balance || '0');
        const totalAmt = parseFloat(qi.TotalAmt || '0');
        const custId = qi.CustomerRef?.value;
        missing.push({
          qb_id: qi.Id,
          doc_number: qi.DocNumber,
          txn_date: qi.TxnDate,
          due_date: qi.DueDate,
          total_amt: totalAmt,
          balance,
          is_open: balance > 0,
          customer_id: custId,
          customer_name: qi.CustomerRef?.name,
          is_ignored_customer: ignoredCustomerIds.includes(custId),
        });
      }

      missing.sort((a, b) => (b.txn_date || '').localeCompare(a.txn_date || ''));

      const missingValue = missing.reduce((s, i) => s + i.total_amt, 0);
      const openBalance = missing.filter(i => i.balance > 0).reduce((s, i) => s + i.balance, 0);
      const openCount = missing.filter(i => i.balance > 0).length;

      const ignoredMissing = missing.filter(i => i.is_ignored_customer);
      const activeMissing = missing.filter(i => !i.is_ignored_customer);
      const activeMissingValue = activeMissing.reduce((s, i) => s + i.total_amt, 0);
      const activeOpenBalance = activeMissing.filter(i => i.balance > 0).reduce((s, i) => s + i.balance, 0);
      const activeOpenCount = activeMissing.filter(i => i.balance > 0).length;

      return Response.json({
        success: true,
        token_rotated: tokenRotated,
        qb_invoice_count: allQbInvoices.length,
        app_invoice_count: allAppInvoices.length,
        app_with_quickbooks_id: appQbIdSet.size,
        missing_count: missing.length,
        missing_total_value: missingValue,
        missing_open_balance: openBalance,
        missing_open_count: openCount,
        ignored_customer_count: ignoredCustomerIds.length,
        missing_from_ignored_customers: ignoredMissing.length,
        missing_from_active_customers: activeMissing.length,
        active_missing_total_value: activeMissingValue,
        active_missing_open_balance: activeOpenBalance,
        active_missing_open_count: activeOpenCount,
        missing,
      });
    }

    // ── DEFAULT MODE: invoice_dry_run ──
    const invoiceNums = body.invoice_numbers || ['1117', '1124', '1141', '1142', '1137'];
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-issue_date', 500);
    const targetInvoices = allInvoices.filter((inv: any) => invoiceNums.includes(inv.invoice_number));

    const results = [];
    for (const inv of targetInvoices) {
      const result: any = {
        invoice_number: inv.invoice_number,
        app: { status: inv.status, amount: inv.total_amount, client_name: inv.client_name, due_date: inv.due_date, issue_date: inv.issue_date },
        qb: null,
      };

      if (!inv.quickbooks_id) { result.qb = { error: 'No quickbooks_id in app record' }; results.push(result); continue; }

      const invResp = await fetch(`${QB_API_URL}/${realmId}/invoice/${inv.quickbooks_id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
      });
      if (!invResp.ok) { result.qb = { error: `QB API ${invResp.status}`, raw: (await invResp.text()).substring(0, 200) }; results.push(result); continue; }

      const invData = await invResp.json();
      const qbInv = invData.Invoice;
      if (!qbInv) { result.qb = { error: 'No Invoice in QB response' }; results.push(result); continue; }

      const balance = parseFloat(qbInv.Balance || '0');
      const totalAmt = parseFloat(qbInv.TotalAmt || '0');
      let paymentDate = null, paymentAmount = null;
      const paymentLinks: any[] = [];
      for (const line of (qbInv.Line || [])) {
        if (line.LinkedTxn) { for (const lt of line.LinkedTxn) { if (lt.TxnType === 'Payment') paymentLinks.push(lt); } }
      }
      if (paymentLinks.length > 0 && paymentLinks[0].TxnId) {
        const payResp = await fetch(`${QB_API_URL}/${realmId}/payment/${paymentLinks[0].TxnId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
        });
        if (payResp.ok) {
          const payData = await payResp.json();
          if (payData.Payment) { paymentDate = payData.Payment.TxnDate; paymentAmount = parseFloat(payData.Payment.TotalAmt || '0'); }
        }
      }

      result.qb = { balance, total_amt: totalAmt, doc_number: qbInv.DocNumber, due_date: qbInv.DueDate, txn_date: qbInv.TxnDate, has_payment: paymentLinks.length > 0, payment_date: paymentDate, payment_amount: paymentAmount, is_paid: balance === 0, still_open: balance > 0 };
      result.comparison = { amount_match: Math.abs(inv.total_amount - totalAmt) < 0.01, qb_says_paid: balance === 0, app_says_paid: inv.status === 'paid' };
      results.push(result);
    }

    return Response.json({ success: true, token_rotated: tokenRotated, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});