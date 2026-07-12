import React from 'react';
import { useDashInvoices } from './useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { CHART_PALETTE, formatCurrency } from '@/lib/dashboardStyle';
import DashboardSkeleton from './DashboardSkeleton';
import DashboardEmptyState from './DashboardEmptyState';
import { Users } from 'lucide-react';

export default function CustomerLTVCard() {
  const { data: rawInvoices = [], isLoading } = useDashInvoices();
  const invoices = rawInvoices.filter(i => !i.is_demo);
  const calculateLTV = () => {
    // Group paid invoices by customer
    const byCustomer = {};
    invoices.filter(inv => inv.status === 'paid').forEach(inv => {
      const name = inv.client_name || inv.company || 'Unknown';
      if (!byCustomer[name]) byCustomer[name] = { name, total: 0, count: 0, firstDate: null, lastDate: null };
      byCustomer[name].total += inv.total_amount || 0;
      byCustomer[name].count += 1;
      const d = inv.paid_date || inv.issue_date;
      if (d) {
        if (!byCustomer[name].firstDate || d < byCustomer[name].firstDate) byCustomer[name].firstDate = d;
        if (!byCustomer[name].lastDate || d > byCustomer[name].lastDate) byCustomer[name].lastDate = d;
      }
    });

    const customers = Object.values(byCustomer);
    if (customers.length === 0) return { avgLTV: 0, data: [], totalCustomers: 0 };

    const avgLTV = customers.reduce((s, c) => s + c.total, 0) / customers.length;

    // Build chart data: LTV per customer, sorted descending, top 10
    const data = customers
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(c => ({ name: c.name.length > 16 ? c.name.slice(0, 14) + '…' : c.name, ltv: Math.round(c.total), invoices: c.count }));

    return { avgLTV: Math.round(avgLTV), data, totalCustomers: customers.length };
  };

  const { avgLTV, data, totalCustomers } = calculateLTV();

  if (isLoading) return <DashboardSkeleton title rows={4} />;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-brand-green">Customer Lifetime Value</CardTitle>
        <div className="flex flex-wrap gap-6 mt-2">
          <div>
            <p className="text-xs text-gray-500">Avg. LTV</p>
            <p className="text-2xl font-bold text-brand-navy">{formatCurrency(avgLTV)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Customers</p>
            <p className="text-2xl font-bold text-gray-700">{totalCustomers}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(avgLTV * totalCustomers)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-2">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value, name) => [`$${value.toLocaleString()}`, 'LTV']}
                labelFormatter={(label) => label}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <ReferenceLine y={avgLTV} stroke={CHART_PALETTE[1]} strokeDasharray="4 4" label={{ value: `Avg ${formatCurrency(avgLTV)}`, position: 'insideTopRight', fontSize: 11, fill: CHART_PALETTE[1] }} />
              <Bar dataKey="ltv" name="LTV" fill={CHART_PALETTE[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <DashboardEmptyState icon={Users} message="No paid invoice data available" />
        )}
      </CardContent>
    </Card>
  );
}