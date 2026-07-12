import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashReferrals } from './useDashboardData';
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
      queryClient.invalidateQueries({ queryKey: ['dash-referrals'] });
      toast.success('Referral marked as verified & purchased');
    },
    onError: () => toast.error('Failed to update referral'),
  });

  const dismissMutation = useMutation({
    mutationFn: () =>
      base44.entities.Referral.update(referral.id, {
        status: 'not_eligible',
        reviewed_date: new Date().toISOString(),
        review_notes: 'Dismissed — client did not come from a direct broker referral. No commission applies.',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dash-referrals'] });
      toast.success('Dismissed — no commission will be issued');
    },
    onError: () => toast.error('Failed to dismiss referral'),
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
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white gap-1.5 text-xs"
              disabled={markPurchasedMutation.isPending || dismissMutation.isPending}
              onClick={() => markPurchasedMutation.mutate()}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {markPurchasedMutation.isPending ? 'Verifying...' : 'Verify & Mark Purchased'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-gray-500 border-gray-300 hover:bg-gray-50 gap-1.5 text-xs"
              disabled={markPurchasedMutation.isPending || dismissMutation.isPending}
              onClick={() => dismissMutation.mutate()}
            >
              <XCircle className="w-3.5 h-3.5" />
              {dismissMutation.isPending ? 'Dismissing...' : 'Dismiss (No Commission)'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
export default function ActionableReviewQueue() {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);

  const { data: rawReferrals = [], isLoading: loadingReferrals } = useDashReferrals();

  // Exclude demo/broker-demo records from dashboard metrics
  const pendingReferrals = rawReferrals.filter(r => !r.is_demo && r.status === 'pending_review');
  const allReferrals = rawReferrals.filter(r => !r.is_demo && r.status === 'converted_to_client');

  const reviewMutation = useMutation({
    mutationFn: ({ referral_id, action, review_notes }) =>
      base44.functions.invoke('reviewReferral', { referral_id, action, review_notes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dash-referrals'] });
      toast.success(variables.action === 'approve' ? 'Referral approved' : 'Referral rejected');
    },
    onError: (err) => toast.error('Failed: ' + (err.message || 'Unknown error')),
  });

  const handleReferralAction = (referral, action, notes) =>
    reviewMutation.mutateAsync({ referral_id: referral.id, action, review_notes: notes });

  const totalItems = pendingReferrals.length + allReferrals.length;
  const isLoading = loadingReferrals;

  if (isLoading || totalItems === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm">
      {/* Compact Header — always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-800">Review Queue</span>
          <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            {totalItems}
          </span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            {pendingReferrals.length > 0 && `${pendingReferrals.length} referral${pendingReferrals.length !== 1 ? 's' : ''}`}
            {pendingReferrals.length > 0 && allReferrals.length > 0 && ' · '}
            {allReferrals.length > 0 && `${allReferrals.length} verification${allReferrals.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="border-t border-amber-100 px-4 py-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendingReferrals.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Referral Reviews</h3>
                </div>
                {pendingReferrals.map(r => (
                  <ReferralReviewCard key={r.id} referral={r} onAction={handleReferralAction} />
                ))}
              </div>
            )}
            {allReferrals.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proposal Verifications</h3>
                </div>
                {allReferrals.map(r => (
                  <ProposalVerificationCard key={r.id} referral={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}