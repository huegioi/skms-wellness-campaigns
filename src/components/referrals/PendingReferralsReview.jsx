import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock, Building, Mail, User, AlertTriangle, UserPlus, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConvertReferralToClientDialog from '@/components/referrals/ConvertReferralToClientDialog';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function PendingReferralsReview({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [convertingReferral, setConvertingReferral] = useState(null);
  const [selectedProposals, setSelectedProposals] = useState({});

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['referrals', 'pending_review'],
    queryFn: () => base44.entities.Referral.filter({ status: 'pending_review' }, '-referral_date'),
    enabled: open
  });

  const { data: allProposals = [] } = useQuery({
    queryKey: ['allProposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date'),
    enabled: open
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
    enabled: open
  });

  const reviewMutation = useMutation({
    mutationFn: ({ referral_id, action, review_notes }) =>
      base44.functions.invoke('reviewReferral', { referral_id, action, review_notes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      toast.success(variables.action === 'approve' ? 'Referral approved' : 'Referral rejected');
      setReviewNotes(prev => { const n = { ...prev }; delete n[variables.referral_id]; return n; });
      setProcessingId(null);
    },
    onError: (err) => {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
      setProcessingId(null);
    }
  });

  const purchaseMutation = useMutation({
    mutationFn: ({ referral_id, proposal_id }) =>
      base44.functions.invoke('recordReferralPurchase', { referral_id, proposal_id }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      toast.success('Referral marked as purchased');
      setSelectedProposals(prev => { const n = { ...prev }; delete n[variables.referral_id]; return n; });
      setProcessingId(null);
    },
    onError: (err) => {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
      setProcessingId(null);
    }
  });

  const getCandidateProposals = (referral) => {
    const refCompany = (referral.company_name || '').toLowerCase();
    return allProposals.filter(p => {
      if (p.status !== 'accepted') return false;
      if (referral.referred_client_id && p.client_id === referral.referred_client_id) return true;
      const client = allClients.find(c => c.id === p.client_id);
      if (client?.referral_partner_id && referral.referral_partner_id && client.referral_partner_id === referral.referral_partner_id) return true;
      if (!refCompany) return false;
      const clientCompany = (client?.company || client?.name || p.client_name || '').toLowerCase();
      return clientCompany.includes(refCompany) || refCompany.includes(clientCompany);
    });
  };

  const handleAction = (referral, action) => {
    setProcessingId(referral.id + action);
    reviewMutation.mutate({
      referral_id: referral.id,
      action,
      review_notes: reviewNotes[referral.id] || ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Clock className="w-5 h-5" />
            Pending Referral Reviews
            {referrals.length > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-300">
                {referrals.length}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">All caught up!</p>
            <p className="text-gray-400 text-sm mt-1">No referrals are awaiting review.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-500">
              Review each referral before it's officially recorded. Approved referrals move to <strong>Submitted</strong> status. Rejected referrals are marked <strong>Not Eligible</strong>.
            </p>
            {referrals.map(r => (
              <div key={r.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 flex items-center gap-1">
                        <User className="w-4 h-4 text-gray-400" /> {r.contact_name}
                      </span>
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-xs">
                        Pending Review
                      </Badge>
                    </div>
                    {r.company_name && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                        <Building className="w-3.5 h-3.5" /> {r.company_name}
                      </p>
                    )}
                    {r.contact_email && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {r.contact_email}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-400 flex-shrink-0">
                    <p className="font-medium text-gray-600">{r.referral_partner_name}</p>
                    <p>{r.referral_date ? format(new Date(r.referral_date), 'MMM d, yyyy') : ''}</p>
                  </div>
                </div>

                {r.notes && (
                  <p className="text-sm text-gray-600 bg-white border border-amber-100 rounded-lg px-3 py-2 italic">
                    "{r.notes}"
                  </p>
                )}

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Review notes (optional)</label>
                  <Textarea
                    rows={2}
                    placeholder="Add internal notes about this referral..."
                    className="text-sm bg-white"
                    value={reviewNotes[r.id] || ''}
                    onChange={e => setReviewNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                  />
                </div>

                <div className="border-t border-amber-200 pt-3">
                  <label className="text-xs text-gray-500 block mb-1">Link a proposal to mark as purchased</label>
                  {getCandidateProposals(r).length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      No accepted proposals found for this partner yet. Approve first, then link from the partner detail page.
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={selectedProposals[r.id] || ''}
                        onValueChange={(val) => setSelectedProposals(prev => ({ ...prev, [r.id]: val }))}
                      >
                        <SelectTrigger className="bg-white text-sm flex-1">
                          <SelectValue placeholder="Select an accepted proposal..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getCandidateProposals(r).map(p => {
                            const c = allClients.find(cl => cl.id === p.client_id);
                            const companyLabel = c?.company || c?.name || p.client_name || 'Unknown';
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                {companyLabel} — ${p.total_amount?.toLocaleString()} ({new Date(p.created_date).toLocaleDateString()})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-1.5"
                        disabled={!!processingId || !selectedProposals[r.id]}
                        onClick={() => {
                          setProcessingId(r.id + 'purchase');
                          purchaseMutation.mutate({ referral_id: r.id, proposal_id: selectedProposals[r.id] });
                        }}
                      >
                        <DollarSign className="w-4 h-4" />
                        {processingId === r.id + 'purchase' ? '...' : 'Purchase'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="bg-[#264d44] hover:bg-[#1a3830] text-white gap-1.5"
                    onClick={() => setConvertingReferral(r)}
                  >
                    <UserPlus className="w-4 h-4" />
                    Convert to Client
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                    disabled={!!processingId}
                    onClick={() => handleAction(r, 'approve')}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processingId === r.id + 'approve' ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 gap-1.5"
                    disabled={!!processingId}
                    onClick={() => handleAction(r, 'reject')}
                  >
                    <XCircle className="w-4 h-4" />
                    {processingId === r.id + 'reject' ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      {convertingReferral && (
        <ConvertReferralToClientDialog
          referral={convertingReferral}
          open={!!convertingReferral}
          onOpenChange={(o) => !o && setConvertingReferral(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['referrals'] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
          }}
        />
      )}
      </DialogContent>
    </Dialog>
  );
}