import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function RecordCommissionPaymentDialog({ partner, open, onOpenChange, onSuccess }) {
  const qc = useQueryClient();
  const [referralId, setReferralId] = useState('__unallocated__');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: referrals = [] } = useQuery({
    queryKey: ['partnerReferrals', partner?.id],
    queryFn: () => base44.entities.Referral.filter({ referral_partner_id: partner.id }, '-referral_date'),
    enabled: !!partner?.id && open,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['partnerPayments', partner?.id],
    queryFn: () => base44.entities.ReferralActivity.filter(
      { referral_partner_id: partner.id, activity_type: 'commission_payment' },
      '-activity_date'
    ),
    enabled: !!partner?.id && open,
  });

  const purchasedReferrals = useMemo(
    () => referrals.filter((r) => r.status === 'purchased' && r.commission_amount > 0),
    [referrals]
  );

  const selectedReferral = purchasedReferrals.find((r) => r.id === referralId);

  const paidForSelected = useMemo(() => {
    if (referralId === '__unallocated__' || !selectedReferral) return 0;
    return allPayments
      .filter((p) => p.referral_id === referralId)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [allPayments, referralId, selectedReferral]);

  const remaining = selectedReferral
    ? Math.max(0, selectedReferral.commission_amount - paidForSelected)
    : 0;

  const mutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('recordCommissionPayment', payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['referralPartners'] });
      qc.invalidateQueries({ queryKey: ['partnerReferrals'] });
      qc.invalidateQueries({ queryKey: ['partnerPayments'] });
      qc.invalidateQueries({ queryKey: ['referrals'] });
      toast.success('Commission payment recorded');
      setAmount('');
      setReferralId('__unallocated__');
      onSuccess?.();
    },
    onError: (err) => toast.error('Failed: ' + (err.message || 'Unknown error')),
  });

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    mutation.mutate({
      partner_id: partner.id,
      referral_id: referralId === '__unallocated__' ? null : referralId,
      amount: amt,
      payment_date: paymentDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Record Commission Payment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Partner</label>
            <p className="text-sm text-gray-600">{partner?.name}</p>
          </div>

          {purchasedReferrals.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Allocate to referral</label>
              <Select value={referralId} onValueChange={setReferralId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unallocated__">Unallocated (general payment)</SelectItem>
                  {purchasedReferrals.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.company_name || r.contact_name} — ${r.commission_amount.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReferral && (
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span>Commission: <strong className="text-gray-700">${selectedReferral.commission_amount.toLocaleString()}</strong></span>
                  <span>Paid: <strong className="text-green-700">${paidForSelected.toLocaleString()}</strong></span>
                  <span>Remaining: <strong className="text-orange-600">${remaining.toLocaleString()}</strong></span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Amount *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Date</label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <DollarSign className="w-4 h-4" />
              {mutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}