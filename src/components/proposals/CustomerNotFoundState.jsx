import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, CheckCircle, X, Plus } from 'lucide-react';

export default function CustomerNotFoundState({ notFoundData, proposal, onRebuild, onClose }) {
  const [confirmedNoMatch, setConfirmedNoMatch] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Similar customers query — runs once on mount
  const { data: similarData, isLoading: isLoadingSimilar } = useQuery({
    queryKey: ['qbCustomerFindSimilar', proposal?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('qbCustomerFindSimilar', {
        company: notFoundData.searched_display_name,
        email: notFoundData.searched_email,
      });
      return res.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const similarCustomers = similarData?.similar_customers || [];

  // Use a similar customer — writes its ID to the Client record, then rebuilds
  const useSimilarMutation = useMutation({
    mutationFn: async (customerId) => {
      if (proposal.client_id) {
        await base44.entities.Client.update(proposal.client_id, {
          quickbooks_customer_id: customerId,
        });
      }
    },
    onSuccess: () => onRebuild(),
    onError: (err) => {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to link customer.');
    },
  });

  // Create customer — calls qbCustomerCreate, then rebuilds
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('qbCustomerCreate', {
        proposal_id: proposal.id,
      });
      return res.data;
    },
    onSuccess: () => onRebuild(),
    onError: (err) => {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to create customer.');
    },
  });

  const canCreate = similarCustomers.length === 0 || confirmedNoMatch;
  const isBusy = createMutation.isPending || useSimilarMutation.isPending;
  const isDone = createMutation.isSuccess || useSimilarMutation.isSuccess;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customer Not Found in QuickBooks</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* What was searched */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
            <p className="font-semibold text-gray-700">Searched QuickBooks for:</p>
            <p>Email: <span className="font-medium">{notFoundData.searched_email || '—'}</span></p>
            {notFoundData.searched_domain && (
              <p>Domain: <span className="font-medium">{notFoundData.searched_domain}</span></p>
            )}
            {notFoundData.searched_display_name && (
              <p>Company name: <span className="font-medium">{notFoundData.searched_display_name}</span></p>
            )}
          </div>

          {/* Similar customers */}
          {isLoadingSimilar ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching for similar QuickBooks customers...
            </div>
          ) : similarCustomers.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">
                These QuickBooks customers look similar — is one of them this client?
              </p>
              {similarCustomers.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="text-sm">
                    <p className="font-medium">{c.display_name || '—'}</p>
                    <p className="text-gray-500">{c.email || 'No email on file'}</p>
                    <p className="text-xs text-gray-400">QB ID: {c.id}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy || isDone}
                    onClick={() => useSimilarMutation.mutate(c.id)}
                  >
                    Use this customer
                  </Button>
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-600 pt-2 cursor-pointer">
                <Checkbox
                  checked={confirmedNoMatch}
                  onCheckedChange={setConfirmedNoMatch}
                  disabled={isBusy || isDone}
                />
                None of these match
              </label>
            </div>
          ) : (
            !isLoadingSimilar && (
              <p className="text-sm text-gray-500">No similar customers found in QuickBooks.</p>
            )
          )}

          {/* Action error (6240 duplicate or other) */}
          {actionError && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {actionError}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={isBusy}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              className="bg-[#013f7c] hover:bg-[#012d5a]"
              disabled={!canCreate || isBusy || isDone}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating...</>
              ) : isDone ? (
                <><CheckCircle className="w-4 h-4 mr-1" /> Created</>
              ) : (
                <><Plus className="w-4 h-4 mr-1" /> Create Customer in QuickBooks</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}