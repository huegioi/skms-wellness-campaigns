import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { DollarSign, Receipt } from 'lucide-react';

export default function CommissionPaymentsLedger({ partnerId }) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['partnerPayments', partnerId],
    queryFn: () => base44.entities.ReferralActivity.filter(
      { referral_partner_id: partnerId, activity_type: 'commission_payment' },
      '-activity_date'
    ),
  });

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-2">Loading payments...</p>;
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-6">
        <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No commission payments recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <span className="text-sm font-medium text-green-800">Total Paid</span>
        <span className="text-lg font-bold text-green-700">${totalPaid.toLocaleString()}</span>
      </div>
      {payments.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between text-sm bg-white border rounded-lg px-3 py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{p.message}</p>
              <p className="text-xs text-gray-400">{format(new Date(p.activity_date), 'MMM d, yyyy')}</p>
            </div>
          </div>
          <span className="font-bold text-green-700 shrink-0 ml-2">${(p.amount || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}