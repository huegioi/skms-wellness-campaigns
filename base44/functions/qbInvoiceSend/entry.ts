import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, QB_API_URL } from '../../shared/quickbooksAuth.ts';
import { computeFingerprint } from '../../shared/invoiceFingerprint.ts';

// POST /api/functions/qbInvoiceSend
//
// Accepts { proposal_id, invoice_body, fingerprint } and creates an UNSENT
// invoice in QuickBooks using the exact body from the review screen — not
// rebuilt from proposal_id. A rebuild can differ from what was approved.
//
// The fingerprint ensures the body hasn't been modified between review and
// send. If it doesn't match, we refuse with 409.
//
// Before POSTing, we refuse if the Proposal already has a quickbooks_invoice_id.
// On success, we write to the Proposal FIRST (quickbooks_invoice_id +
// quickbooks_doc_number), then create the Invoice record. That ordering closes
// the crash window: if we crash after the QB POST but before the Invoice write,
// the Proposal still records the QB invoice id, so a retry will refuse.
//
// One QuickBooks call. No retries on a non-2xx — report the error and leave
// the Proposal untouched so a retry is deliberate.
//
// ── UNSCIENT IS BY DESIGN ──
// The invoice is created without EmailStatus, DeliveryInfo, SalesTermRef, or
// DueDate. BillEmail is set so the recipient field is populated for manual
// dispatch. DueDate is read back from the response (QuickBooks applies the
// customer's default terms). Adding a send call (POST /invoice/{id}/send) is
// a product decision, not a bug fix — do not add it without explicit approval.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { proposal_id, invoice_body, fingerprint } = body;

    if (!proposal_id || !invoice_body || !fingerprint) {
      return Response.json({ error: 'proposal_id, invoice_body, and fingerprint are required' }, { status: 400 });
    }

    // ── Fingerprint check ──
    const computedFingerprint = await computeFingerprint(invoice_body);
    if (computedFingerprint !== fingerprint) {
      return Response.json({
        error: 'Fingerprint mismatch — invoice body has been modified since review.',
      }, { status: 409 });
    }

    // ── Load proposal ──
    const proposal = await base44.asServiceRole.entities.Proposal.get(proposal_id);
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    // ── Idempotency guard — refuse if already invoiced ──
    if (proposal.quickbooks_invoice_id) {
      return Response.json({
        error: 'This proposal already has a QuickBooks invoice.',
        quickbooks_invoice_id: proposal.quickbooks_invoice_id,
        quickbooks_doc_number: proposal.quickbooks_doc_number,
      }, { status: 409 });
    }

    // ── POST to QuickBooks ──
    // See the file-level comment: unsent is by design. No /send endpoint,
    // no EmailStatus, no DeliveryInfo. BillEmail is set in the body.
    const realmId = await getRealmId(base44);
    if (!realmId) return Response.json({ error: 'No realm_id configured' }, { status: 500 });
    const { accessToken } = await getAccessToken(base44);

    const qbResponse = await fetch(`${QB_API_URL}/${realmId}/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(invoice_body),
    });

    if (!qbResponse.ok) {
      const errorText = await qbResponse.text();
      let errorMsg = 'QuickBooks invoice creation failed';
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.Fault?.Error?.[0]?.Message || errorMsg;
      } catch {
        errorMsg = errorText;
      }
      // No retry. Report the error and leave the Proposal untouched.
      return Response.json({
        error: errorMsg,
        quickbooks_http_status: qbResponse.status,
      }, { status: 502 });
    }

    const qbResult = await qbResponse.json();
    const qbInvoice = qbResult.Invoice;
    const qbInvoiceId = qbInvoice.Id;
    const qbDocNumber = qbInvoice.DocNumber || null;
    const qbDueDate = qbInvoice.DueDate || null;
    const qbTotalAmt = qbInvoice.TotalAmt || 0;

    // ── Write to Proposal FIRST ──
    // Closes the crash window: if we crash after the QB POST but before the
    // Invoice write, the Proposal still records the QB invoice id so a retry
    // refuses rather than creating a duplicate.
    await base44.asServiceRole.entities.Proposal.update(proposal_id, {
      quickbooks_invoice_id: qbInvoiceId,
      quickbooks_doc_number: qbDocNumber,
    });

    // ── Then create the Invoice record ──
    const invoiceData = {
      proposal_id,
      client_id: proposal.client_id || '',
      client_name: proposal.client_name || '',
      client_email: proposal.client_email || '',
      company: proposal.company || '',
      invoice_number: qbDocNumber || '',
      line_items: (invoice_body.Line || [])
        .filter(l => l.DetailType === 'SalesItemLineDetail')
        .map(l => ({
          description: l.Description || '',
          quantity: l.SalesItemLineDetail?.Qty || 1,
          rate: l.SalesItemLineDetail?.UnitPrice || 0,
          amount: l.Amount || 0,
        })),
      subtotal: qbTotalAmt,
      total_amount: qbTotalAmt,
      status: 'created_in_quickbooks',
      issue_date: invoice_body.TxnDate || new Date().toISOString().split('T')[0],
      due_date: qbDueDate,
      quickbooks_id: qbInvoiceId,
      quickbooks_sync_date: new Date().toISOString(),
      memo: invoice_body.CustomerMemo?.value || '',
    };

    const invoice = await base44.asServiceRole.entities.Invoice.create(invoiceData);

    return Response.json({
      success: true,
      quickbooks_invoice_id: qbInvoiceId,
      quickbooks_doc_number: qbDocNumber,
      due_date: qbDueDate,
      invoice_id: invoice.id,
      message: 'Created in QuickBooks — not yet sent',
    });

  } catch (error) {
    console.error('qbInvoiceSend error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}