import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, QB_API_URL } from '../../shared/quickbooksAuth.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'items';

    const { accessToken, tokenRotated } = await getAccessToken(base44);
    const realmId = await getRealmId(base44);

    async function qbQuery(sql: string): Promise<any> {
      const resp = await fetch(`${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(sql)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
      });
      if (!resp.ok) throw new Error(`QB query failed (${resp.status}): ${(await resp.text()).substring(0, 500)}`);
      return resp.json();
    }

    // ── MODE: items ──
    // Query all QuickBooks Items, paginated, returning Id, Name, Type,
    // IncomeAccountRef, UnitPrice, and Active status.
    if (mode === 'items') {
      let allItems: any[] = [];
      let startPosition = 1;
      const pageSize = 1000;

      while (true) {
        const sql = `SELECT Id, Name, Type, IncomeAccountRef, UnitPrice, Active FROM Item STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
        const data = await qbQuery(sql);
        const batch = data.QueryResponse?.Item || [];
        allItems = allItems.concat(batch);
        if (batch.length < pageSize) break;
        startPosition += pageSize;
      }

      // Compact pipe-delimited format to avoid response truncation
      const itemLines = allItems.map((it: any) => {
        const acct = it.IncomeAccountRef ? `${it.IncomeAccountRef.value}:${it.IncomeAccountRef.name}` : 'none';
        const price = it.UnitPrice != null ? parseFloat(it.UnitPrice) : null;
        return `${it.Id}|${it.Name}|${it.Type}|${acct}|${price}`;
      });

      // Support optional start/limit to paginate past output truncation
      const start = body.start || 0;
      const limit = body.limit || itemLines.length;
      const paged = itemLines.slice(start, start + limit);

      return Response.json({
        success: true,
        token_rotated: tokenRotated,
        total_items: itemLines.length,
        returned: paged.length,
        start,
        items: paged,
      });
    }

    // ── MODE: invoice_lines ──
    // Fetch full invoice objects (including Line arrays) by DocNumber.
    // If find_paid is true, also fetch the most recent paid invoice.
    if (mode === 'invoice_lines') {
      const invoiceNumbers: string[] = body.invoice_numbers || [];
      const findPaid = body.find_paid === true;
      const results: any[] = [];

      // Fetch specified invoices by DocNumber
      for (const docNum of invoiceNumbers) {
        const sql = `SELECT * FROM Invoice WHERE DocNumber = '${docNum}' MAXRESULTS 1`;
        const data = await qbQuery(sql);
        const qbInv = data.QueryResponse?.Invoice?.[0];
        if (!qbInv) {
          results.push({ doc_number: docNum, error: 'Not found in QuickBooks' });
          continue;
        }

        results.push({
          doc_number: qbInv.DocNumber,
          qb_id: qbInv.Id,
          txn_date: qbInv.TxnDate,
          customer: qbInv.CustomerRef?.name,
          total_amt: parseFloat(qbInv.TotalAmt || '0'),
          balance: parseFloat(qbInv.Balance || '0'),
          is_paid: parseFloat(qbInv.Balance || '0') === 0,
          lines: (qbInv.Line || []).map((line: any) => {
            const dt = line.DetailType;
            const itemRef = line.SalesItemLineDetail?.ItemRef?.name || '';
            const itemId = line.SalesItemLineDetail?.ItemRef?.value || '';
            const acct = line.SalesItemLineDetail?.AccountRef?.name || '';
            const desc = (line.Description || '').replace(/\n/g, ' ').substring(0, 80);
            const qty = line.SalesItemLineDetail?.Qty != null ? parseFloat(line.SalesItemLineDetail.Qty) : '';
            const up = line.SalesItemLineDetail?.UnitPrice != null ? parseFloat(line.SalesItemLineDetail.UnitPrice) : '';
            const amt = line.Amount != null ? parseFloat(line.Amount) : '';
            const linked = line.LinkedTxn ? `linked:${line.LinkedTxn.map((lt: any) => `${lt.TxnType}:${lt.TxnId}`).join(',')}` : '';
            return `${dt}|${itemId}:${itemRef}|${acct}|${desc}|qty=${qty}|up=${up}|amt=${amt}|${linked}`;
          }),
        });
      }

      // Find a recent paid invoice if requested
      let paidInvoice = null;
      if (findPaid) {
        const paidSql = `SELECT * FROM Invoice WHERE Balance = '0' ORDERBY TxnDate DESC MAXRESULTS 1`;
        const paidData = await qbQuery(paidSql);
        const qbInv = paidData.QueryResponse?.Invoice?.[0];
        if (qbInv) {
          paidInvoice = {
            doc_number: qbInv.DocNumber,
            qb_id: qbInv.Id,
            txn_date: qbInv.TxnDate,
            customer: qbInv.CustomerRef?.name,
            total_amt: parseFloat(qbInv.TotalAmt || '0'),
            balance: parseFloat(qbInv.Balance || '0'),
            is_paid: true,
            lines: (qbInv.Line || []).map((line: any) => {
              const dt = line.DetailType;
              const itemRef = line.SalesItemLineDetail?.ItemRef?.name || '';
              const itemId = line.SalesItemLineDetail?.ItemRef?.value || '';
              const acct = line.SalesItemLineDetail?.AccountRef?.name || '';
              const desc = (line.Description || '').replace(/\n/g, ' ').substring(0, 80);
              const qty = line.SalesItemLineDetail?.Qty != null ? parseFloat(line.SalesItemLineDetail.Qty) : '';
              const up = line.SalesItemLineDetail?.UnitPrice != null ? parseFloat(line.SalesItemLineDetail.UnitPrice) : '';
              const amt = line.Amount != null ? parseFloat(line.Amount) : '';
              const linked = line.LinkedTxn ? `linked:${line.LinkedTxn.map((lt: any) => `${lt.TxnType}:${lt.TxnId}`).join(',')}` : '';
              return `${dt}|${itemId}:${itemRef}|${acct}|${desc}|qty=${qty}|up=${up}|amt=${amt}|${linked}`;
            }),
          };
        }
      }

      return Response.json({
        success: true,
        token_rotated: tokenRotated,
        requested_invoices: results,
        paid_invoice: paidInvoice,
      });
    }

    return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});