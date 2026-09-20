import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RecordDetailContent, RecordDetailFrame, RailSection, FrameSection } from '@/components/shared/RecordDetailFrame';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, CheckCircle, Send, X, AlertTriangle } from 'lucide-react';
import CustomerNotFoundState from './CustomerNotFoundState';

const STRATEGY_LABELS = {
  exact_email: 'Exact email match',
  email_domain: 'Email domain match',
  display_name: 'Display name match',
  domain_ambiguous: 'Domain ambiguous',
  domain_skipped_freemail: 'Free-mail — domain search skipped',
  stored_customer_id: 'Stored QuickBooks customer ID',
};

const NEEDS_VERIFICATION = new Set(['email_domain', 'display_name', 'domain_ambiguous']);

export default function QuickBooksInvoiceReview({ proposal, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [rebuildKey, setRebuildKey] = useState(0);

  // Dry-run query — runs only when the dialog is open and no send has happened.
  // Not a poll, not a refetch — single fetch per open.
  // rebuildKey is incremented to force a re-fetch after customer creation/linking.
  const { data: dryRun, isLoading, error } = useQuery({
    queryKey: ['qbInvoiceBuild', proposal?.id, rebuildKey],
    queryFn: async () => {
      const res = await base44.functions.invoke('qbInvoiceBuild', { proposal_id: proposal.id });
      return res.data;
    },
    enabled: open && !!proposal?.id && !sendResult,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Send mutation — triggered ONLY by the click handler, not on mount or interval.
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('qbInvoiceSend', {
        proposal_id: proposal.id,
        invoice_body: dryRun.invoice_body,
        fingerprint: dryRun.fingerprint,
        line_service_ids: dryRun.line_service_ids,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSendResult(data);
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (err) => {
      setSendError(err?.response?.data?.error || err?.message || 'Failed to create invoice in QuickBooks.');
    },
  });

  const handleClose = () => {
    setSendResult(null);
    setSendError(null);
    onOpenChange(false);
  };

  // ── Success state ──
  if (sendResult) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QuickBooks Invoice Created</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <p className="font-semibold text-green-700">{sendResult.message}</p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>DocNumber: <span className="font-semibold">{sendResult.quickbooks_doc_number || '—'}</span></p>
              <p>QuickBooks Invoice ID: <span className="font-semibold">{sendResult.quickbooks_invoice_id}</span></p>
              {sendResult.due_date && (
                <p>Due Date: <span className="font-semibold">{new Date(sendResult.due_date).toLocaleDateString()}</span></p>
              )}
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleClose}>Done</Button>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preparing QuickBooks Invoice</DialogTitle>
          </DialogHeader>
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#013f7c]" />
            <p className="text-sm text-gray-500 mt-3">Resolving customer and building invoice lines...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Error state ──
  if (error) {
    const errData = error?.response?.data || {};
    const statusCode = error?.response?.status;

    // 404 — customer not found: delegate to CustomerNotFoundState
    if (statusCode === 404) {
      return (
        <CustomerNotFoundState
          notFoundData={errData}
          proposal={proposal}
          onRebuild={() => setRebuildKey(k => k + 1)}
          onClose={handleClose}
        />
      );
    }

    const isAlreadyInvoiced = statusCode === 409 || errData.blocked === 'idempotency' || errData.quickbooks_invoice_id;
    const invoiceId = errData.existing_quickbooks_id || errData.quickbooks_invoice_id;

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QuickBooks Invoice</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6 space-y-3">
            {isAlreadyInvoiced ? (
              <>
                <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                <p className="font-semibold">Already invoiced — DocNumber {errData.existing_doc_number || errData.quickbooks_doc_number || '—'}</p>
                <p className="text-sm text-gray-600">
                  This proposal already has a QuickBooks invoice.{invoiceId ? ` (QB ID: ${invoiceId})` : ''}
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 mx-auto text-red-400" />
                <p className="font-semibold text-red-700">Could not prepare invoice</p>
                <p className="text-sm text-gray-500">{errData.error || errData.message || error?.message || 'Unknown error'}</p>
                <p className="text-sm text-gray-600">Couldn't reach QuickBooks. The connection may need re-authorizing.</p>
                {statusCode && (
                  <p className="text-xs text-gray-400">HTTP {statusCode}</p>
                )}
              </>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={handleClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Review state ──
  if (!dryRun) return null;

  const blockingErrors = dryRun.blocking_errors || [];
  const hasBlocking = blockingErrors.length > 0;
  const lineAnalysis = dryRun.line_analysis || [];
  const invoiceBody = dryRun.invoice_body || {};
  const warnings = dryRun.warnings || [];
  const customerRes = dryRun.customer_resolution || {};
  const strategyLabel = STRATEGY_LABELS[customerRes.strategy] || customerRes.strategy;
  const needsVerification = NEEDS_VERIFICATION.has(customerRes.strategy);

  const invoiceTotal = (invoiceBody.Line || [])
    .filter(l => l.DetailType === 'SalesItemLineDetail')
    .reduce((sum, l) => sum + (l.Amount || 0), 0);

  const proposalTotal = proposal?.total_amount || 0;
  const difference = Math.abs(invoiceTotal - proposalTotal);
  const totalsDiffer = difference > 0.01;

  const docNumber = invoiceBody.DocNumber || null;

  // ── Responsive layout (see RecordDetailFrame) ──
  // Main: anything blocking, the invoice lines, warnings. Rail: who it bills
  // and how the totals compare. Footer: Send stays pinned.
  const blockingPanel = hasBlocking && (() => {
    const allReasons = blockingErrors.map(e => e.reason || '');
    const isPriceOnly = allReasons.every(r => /price|pricing/i.test(r));
    const isItemOnly = allReasons.every(r => /item/i.test(r));
    const headlineReason = isPriceOnly
      ? '— no price available'
      : isItemOnly
        ? '— no QuickBooks Item'
        : '';
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-red-700">
          <AlertCircle className="w-4 h-4" />
          {blockingErrors.length} line(s) cannot be sent yet{headlineReason}
        </div>
        <p className="text-xs text-red-500">Fix the pricing on the proposal, then reopen this dialog.</p>
        {blockingErrors.map((err, i) => (
          <div key={i} className="text-sm text-red-600 pl-6">
            • {err.name || 'Unknown'} — {err.reason}
          </div>
        ))}
      </div>
    );
  })();

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <DialogTitle className="text-xl font-bold text-[#013f7c]">Review QuickBooks Invoice</DialogTitle>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          {[proposal?.company, proposal?.client_name].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || 'Proposal'}
          {' · '}DocNumber {docNumber || 'assigned by QuickBooks'}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">Invoice total</p>
        <p className={`text-2xl font-bold leading-tight tabular-nums ${totalsDiffer ? 'text-red-600' : 'text-[#013f7c]'}`}>${invoiceTotal.toLocaleString()}</p>
      </div>
    </div>
  );

  const rail = (
    <>
      {/* Customer */}
      <RailSection title="Customer">
        <dl className="space-y-2.5 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-gray-400">QuickBooks customer</dt>
            <dd className="font-semibold break-words">{customerRes.customer_display_name || '—'}</dd>
            <dd className="text-gray-600 break-all">{customerRes.customer_email || '—'}</dd>
            <dd className="text-xs text-gray-400">QB ID: {customerRes.customer_id || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-gray-400">App client</dt>
            <dd className="font-semibold break-words">{proposal?.client_name || '—'}</dd>
            <dd className="text-gray-600 break-all">{proposal?.client_email || '—'}</dd>
          </div>
        </dl>
        <div className="pt-2 mt-2 border-t border-gray-100">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Matched by</p>
          {needsVerification ? (
            <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50 whitespace-normal">
              <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
              {strategyLabel} — needs verification
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50 whitespace-normal">
              {strategyLabel}
            </Badge>
          )}
        </div>
      </RailSection>

      {/* Totals */}
      <RailSection title="Totals">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Invoice total</span>
            <span className="font-semibold tabular-nums">${invoiceTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Proposal total</span>
            <span className="font-semibold tabular-nums">${proposalTotal.toLocaleString()}</span>
          </div>
          {totalsDiffer && (
            <div className="text-red-600 text-sm font-medium pt-1.5 border-t border-red-200">
              ⚠ Invoice total does not match proposal total (difference: ${difference.toLocaleString()})
            </div>
          )}
        </div>
      </RailSection>
    </>
  );

  const footer = (
    <div className="flex justify-between items-center gap-2">
      <Button variant="outline" onClick={handleClose}>
        <X className="w-4 h-4 mr-1" /> Cancel
      </Button>
      <Button
        className="bg-[#013f7c] hover:bg-[#012d5a]"
        disabled={hasBlocking || sendMutation.isPending}
        onClick={() => sendMutation.mutate()}
      >
        {sendMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...</>
        ) : (
          <><Send className="w-4 h-4 mr-1" /> Send to QuickBooks</>
        )}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <RecordDetailContent maxWidth="1080px" fill={false}>
        <RecordDetailFrame header={header} rail={rail} footer={footer}>
          <div className="space-y-5">
            {/* Blocking errors at the top */}
            {blockingPanel}

            {/* Send error */}
            {sendError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {sendError}
              </div>
            )}

            {/* Lines */}
            <FrameSection title={`Lines (${lineAnalysis.length})`}>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                      <th className="py-2 px-3 font-semibold">Description</th>
                      <th className="py-2 px-3 font-semibold">QB Item</th>
                      <th className="py-2 px-3 font-semibold text-right">Qty</th>
                      <th className="py-2 px-3 font-semibold text-right">Unit Price</th>
                      <th className="py-2 px-3 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineAnalysis.map((line, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            {line.name || line.description}
                            {line.confidence === 'guess' && (
                              <span title={`Inferred from Service "${line.name}" — not a resolved Item`}>
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-gray-600">{line.item_name || '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{line.qty}</td>
                        <td className="py-2 px-3 text-right tabular-nums">${(line.price || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">${(line.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FrameSection>

            {/* Warnings */}
            {warnings.length > 0 && (
              <FrameSection title="Warnings" icon={AlertTriangle}>
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  {warnings.map((w, i) => (
                    <div key={i} className="text-sm text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-1 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              </FrameSection>
            )}
          </div>
        </RecordDetailFrame>
      </RecordDetailContent>
    </Dialog>
  );
}
