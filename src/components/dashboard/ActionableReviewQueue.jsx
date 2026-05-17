import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle, XCircle, Clock, Building, Mail, User,
  FileText, DollarSign, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// --- Referral Review Card ---
function ReferralReviewCard({ referral, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(null);

  const handleAction = async (action) => {
    setProcessing(action);
    await onAction(referral, action, notes);
    setProcessing(null);
  };

  return (
    <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800 text-sm">{referral.contact_name}</span>
              <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-medium">Pending Review</Badge>
            </div>
            {referral.company_name && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Building className="w-3 h-3" /> {referral.company_name}
              </p>
            )}
            {referral.contact_email && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Mail className="w-3 h-3" /> {referral.contact_email}
              </p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-medium text-[#264d44]">{referral.referral_partner_name}</p>
          <p className="text-xs text-gray-400">{referral.referral_date ? format(new Date(referral.referral_date), 'MMM d, yyyy') : ''}</p>
          <button onClick={() => setExpanded(!expanded)} className="mt-1 text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div className="border-t border-amber-100 bg-amber-50 px-4 py-3 space-y-3">
          {referral.notes && (
            <p className="text-xs text-gray-600 italic bg-white border border-amber-100 rounded-lg px-3 py-2">
              "{referral.notes}"
            </p>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Review notes (optional)</label>
            <Textarea
              rows={2}
              placeholder="Add internal notes..."
              className="text-xs bg-white"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs"
              disabled={!!processing}
              onClick={() => handleAction('approve')}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {processing === 'approve' ? 'Approving...' : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50 gap-1.5 text-xs"
              disabled={!!processing}
              onClick={() => handleAction('reject')}
            >
              <XCircle className="w-3.5 h-3.5" />
              {processing === 'reject' ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Proposal Verification Card ---
function ProposalVerificationCard({ referral }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);

  const markPurchasedMutation = useMutation({
    mutationFn: () =>
      base44.entities.Referral.update(referral.id, {
        status: 'purchased',
        reviewed_date: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      toast.success('Referral marked as verified & purchased');
    },
    onError: () => toast.error('Failed to update referral'),
  });

  return (
    <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800 text-sm">{referral.contact_name}</span>
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium">Proposal Accepted</Badge>
            </div>
            {referral.company_name && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Building className="w-3 h-3" /> {referral.company_name}
              </p>
            )}
            <p className="text-xs font-medium text-[#264d44] mt-0.5">via {referral.referral_partner_name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {referral.commission_amount > 0 && (
            <p className="text-xs font-semibold text-green-700 flex items-center gap-0.5 justify-end">
              <DollarSign className="w-3 h-3" />
              {referral.commission_amount.toLocaleString()}
            </p>
          )}
          <button onClick={() => setExpanded(!expanded)} className="mt-1 text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-blue-100 bg-blue-50 px-4 py-3 space-y-2">
          <p className="text-xs text-gray-500">
            This referral's proposal has been accepted. Verify and mark as purchased to trigger partner portal provisioning.
          </p>
          <Button
            size="sm"
            className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white gap-1.5 text-xs"
            disabled={markPurchasedMutation.isPending}
            onClick={() => markPurchasedMutation.mutate()}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {markPurchasedMutation.isPending ? 'Verifying...' : 'Verify & Mark Purchased'}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
export default function ActionableReviewQueue() {
  const queryClient = useQueryClient();

  const { data: pendingReferrals = [], isLoading: loadingPending } = useQuery({
    queryKey: ['referrals', 'pending_review'],
    queryFn: () => base44.entities.Referral.filter({ status: 'pending_review' }, '-referral_date'),
  });

  // Accepted-proposal referrals = status 'converted_to_client' or 'contacted' (not yet purchased/reviewed)
  // We look for referrals that are in a "post-contact" state but NOT yet purchased or reviewed
  const { data: allReferrals = [], isLoading: loadingAll } = useQuery({
    queryKey: ['referrals', 'needs_proposal_verification'],
    queryFn: () => base44.entities.Referral.filter({ status: 'converted_to_client' }, '-referral_date'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ referral_id, action, review_notes }) =>
      base44.functions.invoke('reviewReferral', { referral_id, action, review_notes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      toast.success(variables.action === 'approve' ? 'Referral approved' : 'Referral rejected');
    },
    onError: (err) => toast.error('Failed: ' + (err.message || 'Unknown error')),
  });

  const handleReferralAction = (referral, action, notes) =>
    reviewMutation.mutateAsync({ referral_id: referral.id, action, review_notes: notes });

  const totalItems = pendingReferrals.length + allReferrals.length;
  const isLoading = loadingPending || loadingAll;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 border-4 border-[#264d44] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading action items...</span>
        </div>
      </div>
    );
  }

  if (totalItems === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-[#264d44]" />
          <h2 className="text-lg font-bold text-gray-800">Review Queue</h2>
        </div>
        <div className="flex items-center gap-3 py-6 text-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
          <p className="text-gray-500 text-sm">No pending reviews — all caught up!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-gray-800">Review Queue</h2>
          <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {totalItems}
          </span>
        </div>
        <span className="text-xs text-gray-400">Expand a card to take action</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Referral Reviews */}
        {pendingReferrals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-600">Referral Reviews</h3>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingReferrals.length}
              </span>
            </div>
            {pendingReferrals.map(r => (
              <ReferralReviewCard key={r.id} referral={r} onAction={handleReferralAction} />
            ))}
          </div>
        )}

        {/* Proposal Verifications */}
        {allReferrals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-600">Proposal Verifications</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {allReferrals.length}
              </span>
            </div>
            {allReferrals.map(r => (
              <ProposalVerificationCard key={r.id} referral={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}