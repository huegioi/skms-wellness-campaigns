import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, QB_API_URL } from '../../shared/quickbooksAuth.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const invoiceNums = body.invoice_numbers || ['1117', '1124', '1141', '1142', '1137'];

    // Fetch invoices from app DB
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-issue_date', 500);
    const targetInvoices = allInvoices.filter((inv: any) => invoiceNums.includes(inv.invoice_number));

    // Get QB access token (will rotate refresh token — unavoidable side effect)
    const { accessToken, tokenRotated } = await getAccessToken(base44);
    const realmId = await getRealmId(base44);

    const results = [];
    for (const inv of targetInvoices) {
      const result: any = {
        invoice_number: inv.invoice_number,
        app: {
          status: inv.status,
          amount: inv.total_amount,
          client_name: inv.client_name,
          due_date: inv.due_date,
          issue_date: inv.issue_date,
        },
        qb: null,
      };

      if (!inv.quickbooks_id) {
        result.qb = { error: 'No quickbooks_id in app record' };
        results.push(result);
        continue;
      }

      // Fetch invoice from QB
      const invResp = await fetch(`${QB_API_URL}/${realmId}/invoice/${inv.quickbooks_id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
      });

      if (!invResp.ok) {
        result.qb = { error: `QB API ${invResp.status}`, raw: (await invResp.text()).substring(0, 200) };
        results.push(result);
        continue;
      }

      const invData = await invResp.json();
      const qbInv = invData.Invoice;
      if (!qbInv) {
        result.qb = { error: 'No Invoice in QB response' };
        results.push(result);
        continue;
      }

      const balance = parseFloat(qbInv.Balance || '0');
      const totalAmt = parseFloat(qbInv.TotalAmt || '0');

      // Find linked payments via Line.LinkedTxn
      let paymentDate = null;
      let paymentAmount = null;
      const lines = qbInv.Line || [];
      const paymentLinks: any[] = [];
      for (const line of lines) {
        if (line.LinkedTxn) {
          for (const lt of line.LinkedTxn) {
            if (lt.TxnType === 'Payment') paymentLinks.push(lt);
          }
        }
      }

      // Fetch payment details for actual payment date
      if (paymentLinks.length > 0 && paymentLinks[0].TxnId) {
        const payResp = await fetch(`${QB_API_URL}/${realmId}/payment/${paymentLinks[0].TxnId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
        });
        if (payResp.ok) {
          const payData = await payResp.json();
          if (payData.Payment) {
            paymentDate = payData.Payment.TxnDate;
            paymentAmount = parseFloat(payData.Payment.TotalAmt || '0');
          }
        }
      }

      result.qb = {
        balance,
        total_amt: totalAmt,
        doc_number: qbInv.DocNumber,
        due_date: qbInv.DueDate,
        txn_date: qbInv.TxnDate,
        has_payment: paymentLinks.length > 0,
        payment_date: paymentDate,
        payment_amount: paymentAmount,
        is_paid: balance === 0,
        still_open: balance > 0,
      };
      result.comparison = {
        amount_match: Math.abs(inv.total_amount - totalAmt) < 0.01,
        qb_says_paid: balance === 0,
        app_says_paid: inv.status === 'paid',
      };
      results.push(result);
    }

    return Response.json({
      success: true,
      token_rotated: tokenRotated,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});