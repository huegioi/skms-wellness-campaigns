import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, CheckCircle, Send, X, AlertTriangle } from 'lucide-react';

const STRATEGY_LABELS = {
  exact_email: 'Exact email match',
  email_domain: 'Email domain match',
  display_name: 'Display name match',
  domain_ambiguous: 'Domain ambiguous',
  domain_skipped_freemail: 'Free-mail — domain search skipped',
};

const NEEDS_VERIFICATION = new Set(['email_domain', 'display_name', 'domain_ambiguous']);

export default function QuickBooksInvoiceReview({ proposal, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState(null);

  // Dry-run query — runs only when the dialog is open and no send has happened.
  // Not a poll, not a refetch — single fetch per open.
  const { data: dryRun, isLoading, error } = useQuery({
    queryKey: ['qbInvoiceBuild', proposal?.id],
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
    const isAlreadyInvoiced = errData.blocked === 'idempotency' || errData.quickbooks_invoice_id;
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
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 mx-auto text-red-400" />
                <p className="font-semibold text-red-700">Could not prepare invoice</p>
                <p className="text-sm text-gray-500">{errData.message || error?.message || 'Unknown error'}</p>
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Review QuickBooks Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {/* Blocking errors at the top */}
          {hasBlocking && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-red-700">
                <AlertCircle className="w-4 h-4" />
                {blockingErrors.length} line(s) cannot be sent — no QuickBooks Item
              </div>
              {blockingErrors.map((err, i) => (
                <div key={i} className="text-sm text-red-600 pl-6">
                  • {err.name || 'Unknown'} — {err.reason}
                </div>
              ))}
            </div>
          )}

          {/* Send error */}
          {sendError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {sendError}
            </div>
          )}

          {/* Customer */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Customer</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">QuickBooks Customer</p>
                <p className="font-semibold">{customerRes.customer_display_name || '—'}</p>
                <p className="text-gray-600">{customerRes.customer_email || '—'}</p>
                <p className="text-xs text-gray-400">QB ID: {customerRes.customer_id || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">App Client</p>
                <p className="font-semibold">{proposal?.client_name || '—'}</p>
                <p className="text-gray-600">{proposal?.client_email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-500">Matched by:</span>
              {needsVerification ? (
                <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {strategyLabel} — needs verification
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50">
                  {strategyLabel}
                </Badge>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Lines</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 px-2">QB Item</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 pl-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineAnalysis.map((line, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1">
                          {line.name || line.description}
                          {line.confidence === 'guess' && (
                            <span title={`Inferred from Service "${line.name}" — not a resolved Item`}>
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-gray-600">{line.item_name || '—'}</td>
                      <td className="py-2 px-2 text-right">{line.qty}</td>
                      <td className="py-2 px-2 text-right">${(line.price || 0).toLocaleString()}</td>
                      <td className="py-2 pl-2 text-right font-medium">${(line.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Invoice Total:</span>
              <span className="font-semibold">${invoiceTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Proposal Total:</span>
              <span className="font-semibold">${proposalTotal.toLocaleString()}</span>
            </div>
            {totalsDiffer && (
              <div className="text-red-600 text-sm font-medium pt-1 border-t border-red-200">
                ⚠ Invoice total does not match proposal total (difference: ${difference.toLocaleString()})
              </div>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-gray-700">Warnings</h4>
              {warnings.map((w, i) => (
                <div key={i} className="text-sm text-amber-700 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* DocNumber */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">DocNumber:</span>
            <span className="font-medium">{docNumber || 'QuickBooks will assign'}</span>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}