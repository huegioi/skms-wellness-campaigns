import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, Landmark } from 'lucide-react';

export default function BrokerageRollup({ brokerage }) {
  const { data: partners = [] } = useQuery({
    queryKey: ['brokerage-partners', brokerage.id],
    queryFn: () =>
      base44.entities.ReferralPartner.filter(
        { brokerage_id: brokerage.id, is_demo: false },
        '-created_date',
        500
      ),
  });

  const partnerIds = partners.map(p => p.id);

  const { data: referrals = [] } = useQuery({
    queryKey: ['brokerage-referrals', brokerage.id],
    queryFn: async () => {
      if (!partnerIds.length) return [];
      const results = await Promise.all(
        partnerIds.map(id =>
          base44.entities.Referral.filter({ referral_partner_id: id }, '-created_date')
        )
      );
      return results.flat();
    },
    enabled: partnerIds.length > 0,
  });

  const aggregateYtd = partners.reduce((sum, p) => sum + (p.ytd_revenue || 0), 0);
  const houseCommission = referrals.reduce((sum, r) => sum + (r.brokerage_commission || 0), 0);
  const brokerCommission = referrals.reduce((sum, r) => sum + (r.broker_commission || 0), 0);
  const brokerCommissionPaid = partners.reduce((sum, p) => sum + (p.total_commissions_paid || 0), 0);

  // Per-broker breakdown
  const brokerBreakdown = partners.map(p => {
    const pReferrals = referrals.filter(r => r.referral_partner_id === p.id);
    const pBrokerCommission = pReferrals.reduce((s, r) => s + (r.broker_commission || 0), 0);
    return {
      id: p.id,
      name: p.name,
      company: p.company,
      ytd_revenue: p.ytd_revenue || 0,
      broker_commission: pBrokerCommission,
      paid: p.total_commissions_paid || 0,
      referral_count: pReferrals.length,
    };
  });

  return (
    <div className="space-y-4">
      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-brand-navy" />
            <span className="text-xs font-medium text-gray-500">Aggregate YTD</span>
          </div>
          <p className="text-lg font-bold text-brand-navy">${aggregateYtd.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Landmark className="w-3.5 h-3.5 text-brand-plum" />
            <span className="text-xs font-medium text-gray-500">House Commission</span>
          </div>
          <p className="text-lg font-bold text-brand-plum">${houseCommission.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-brand-green" />
            <span className="text-xs font-medium text-gray-500">Broker Commission</span>
          </div>
          <p className="text-lg font-bold text-brand-green">${brokerCommission.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Brokers</span>
          </div>
          <p className="text-lg font-bold text-gray-700">{partners.length}</p>
        </div>
      </div>

      {/* Toggle status */}
      <div className="flex flex-wrap gap-2">
        <Badge className={brokerage.brokerage_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
          Brokerage commission: {brokerage.brokerage_commission_enabled !== false ? 'On' : 'Off'}
        </Badge>
        <Badge className={brokerage.broker_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
          Broker commission: {brokerage.broker_commission_enabled !== false ? 'On' : 'Off'}
        </Badge>
        {brokerage.brokerage_commission_enabled !== false && brokerage.broker_commission_enabled !== false && (
          <Badge className="bg-blue-100 text-blue-700">
            Split: {Math.round((1 - (brokerage.broker_split ?? 0.5)) * 100)}% / {Math.round((brokerage.broker_split ?? 0.5) * 100)}%
          </Badge>
        )}
      </div>

      {/* Per-broker breakdown */}
      {brokerBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Per-Broker Breakdown</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Broker</th>
                  <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">YTD Revenue</th>
                  <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Commission Earned</th>
                  <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Paid</th>
                  <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Referrals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {brokerBreakdown.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-gray-800">{b.name}</p>
                      {b.company && <p className="text-xs text-gray-400">{b.company}</p>}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">${b.ytd_revenue.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-brand-green">${b.broker_commission.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">${b.paid.toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-500">{b.referral_count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="pt-2 font-semibold text-gray-700">Total</td>
                  <td className="pt-2 text-right font-semibold text-gray-700">${aggregateYtd.toLocaleString()}</td>
                  <td className="pt-2 text-right font-bold text-brand-green">${brokerCommission.toLocaleString()}</td>
                  <td className="pt-2 text-right font-semibold text-gray-700">${brokerCommissionPaid.toLocaleString()}</td>
                  <td className="pt-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {brokerBreakdown.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-4">No brokers assigned to this brokerage yet.</p>
      )}
    </div>
  );
}