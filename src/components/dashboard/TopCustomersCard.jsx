import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_PALETTE, formatCurrency } from '@/lib/dashboardStyle';
import DashboardEmptyState from './DashboardEmptyState';
import { Users } from 'lucide-react';

/**
 * Merged "Top Customers" card — one row per customer with revenue (timeframe)
 * and LTV (all-time paid) columns, sorted by revenue.
 * Replaces the old TopIncomeSourcesCard + CustomerLTVCard.
 */
export default function TopCustomersCard({ incomeData, invoices, timeframe }) {
  const { topCustomers } = incomeData;

  // All-time LTV per customer (from all paid invoices, demo-excluded)
  const ltvByCustomer = useMemo(() => {
    const map = {};
    invoices.filter(inv => inv.status === 'paid').forEach(inv => {
      const name = inv.client_name || inv.company || 'Unknown';
      if (!map[name]) map[name] = { total: 0, count: 0 };
      map[name].total += inv.total_amount || 0;
      map[name].count += 1;
    });
    return map;
  }, [invoices]);

  const avgLTV = useMemo(() => {
    const all = Object.values(ltvByCustomer);
    if (all.length === 0) return 0;
    return Math.round(all.reduce((s, c) => s + c.total, 0) / all.length);
  }, [ltvByCustomer]);

  const totalRevenue = topCustomers.reduce((s, c) => s + c.value, 0);

  // Merge revenue (timeframe) + LTV (all-time) per customer
  const rows = useMemo(() => {
    return topCustomers.map(c => {
      const ltv = ltvByCustomer[c.name] || { total: 0, count: 0 };
      return {
        name: c.name,
        revenue: c.value,
        ltv: ltv.total,
        invoiceCount: ltv.count,
      };
    });
  }, [topCustomers, ltvByCustomer]);

  const timeframeLabel = timeframe === 'month' ? 'This Month' : timeframe === 'quarter' ? 'This Quarter' : timeframe === 'year' ? 'This Year' : 'All Time';

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-brand-green">Top Customers</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          {timeframeLabel} revenue & all-time LTV — paid invoices only
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length > 0 ? (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="flex flex-wrap gap-6 pb-2 border-b">
              <div>
                <p className="text-xs text-gray-500">Avg. LTV</p>
                <p className="text-xl font-bold text-brand-navy">{formatCurrency(avgLTV)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Customers (all-time)</p>
                <p className="text-xl font-bold text-gray-700">{Object.keys(ltvByCustomer).length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{timeframeLabel} Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>

            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={rows} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="revenue" name="Revenue" fill={CHART_PALETTE[0]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Customer rows */}
            <div className="space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 px-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Customer</div>
                <div className="col-span-3 text-right">Revenue</div>
                <div className="col-span-3 text-right">LTV (all-time)</div>
              </div>
              {rows.map((row, idx) => {
                const pct = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={row.name} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="col-span-1">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-green text-white text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                    </div>
                    <div className="col-span-5 min-w-0">
                      <p className="font-semibold text-gray-800 truncate text-sm">{row.name}</p>
                      <p className="text-xs text-gray-400">{row.invoiceCount} invoice{row.invoiceCount !== 1 ? 's' : ''} (all-time) · {pct.toFixed(1)}% of period</p>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="font-bold text-brand-green text-sm">{formatCurrency(row.revenue)}</p>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="font-bold text-brand-navy text-sm">{formatCurrency(row.ltv)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <DashboardEmptyState icon={Users} message="No paid invoice data for this period" />
        )}
      </CardContent>
    </Card>
  );
}