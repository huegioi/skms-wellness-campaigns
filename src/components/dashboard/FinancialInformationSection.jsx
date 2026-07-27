import React, { useState } from 'react';
import { useDashInvoices, useDashServices } from './useDashboardData';
import { buildServiceMatcher } from '@/lib/serviceMatching';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DollarSign, CheckCircle2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_PALETTE, formatCurrency } from '@/lib/dashboardStyle';
import DashboardSkeleton from './DashboardSkeleton';
import DashboardEmptyState from './DashboardEmptyState';
import ReceivablesAgingTable from '@/components/financials/ReceivablesAgingTable';
import RevenueByClientPanel from '@/components/financials/RevenueByClientPanel';
import BookedNotDeliveredTile from '@/components/financials/BookedNotDeliveredTile';

export default function FinancialInformationSection() {
  const [timeframe, setTimeframe] = useState('year');
  const [syncing, setSyncing] = useState(false);

  const { data: rawInvoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useDashInvoices();
  const { data: services = [] } = useDashServices();

  // Exclude demo/broker-demo records from dashboard metrics
  const invoices = rawInvoices.filter(i => !i.is_demo && !i.out_of_scope);

  if (loadingInvoices) {
    return (
      <div className="space-y-8">
        <DashboardSkeleton title rows={4} />
        <DashboardSkeleton rows={4} />
      </div>
    );
  }

  const calculateMetrics = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startDate = timeframe === 'month' ? startOfMonth : timeframe === 'quarter' ? startOfQuarter : timeframe === 'year' ? startOfYear : new Date(0);

    const periodInvoices = invoices.filter(inv => {
      const d = inv.issue_date;
      return d && new Date(d) >= startDate;
    });

    const totalInvoiced = periodInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    return { totalInvoiced, totalPaid };
  };

  const metrics = calculateMetrics();

  const handleSyncFinancials = async () => {
    setSyncing(true);
    try {
      await refetchInvoices();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Revenue by Service Line — accrual basis (all invoices by issue_date),
  // grouped by service category. Falls back to line description where no
  // category is resolvable.
  const generateServiceLineBreakdown = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startDate = timeframe === 'month' ? startOfMonth : timeframe === 'quarter' ? startOfQuarter : timeframe === 'year' ? startOfYear : new Date(0);

    const periodInvoices = invoices.filter(inv => {
      const d = inv.issue_date;
      return d && new Date(d) >= startDate;
    });

    const matchService = buildServiceMatcher(services);
    const categoryLabels = {
      workshop: 'Workshop',
      challenge: 'Challenge',
      leadership: 'Leadership',
      class: 'Class',
      wellness_box: 'Box',
    };

    const byCategory = {};
    const descAmounts = {};
    let unmatchedCount = 0;
    let unmatchedRevenue = 0;
    let totalRevenue = 0;

    periodInvoices.forEach(inv => {
      if (!inv.line_items || !Array.isArray(inv.line_items)) return;
      inv.line_items.forEach(item => {
        const amount = item.amount || 0;
        const service = matchService(item);
        let label;
        if (service) {
          label = categoryLabels[service.category] || service.category;
        } else {
          label = 'Custom / Uncategorized';
          unmatchedCount++;
          unmatchedRevenue += amount;
          const desc = (item.description || '(no description)').trim();
          descAmounts[desc] = (descAmounts[desc] || 0) + amount;
        }
        byCategory[label] = (byCategory[label] || 0) + amount;
        totalRevenue += amount;
      });
    });

    const serviceBreakdown = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topDescriptions = Object.entries(descAmounts)
      .map(([desc, amount]) => ({ desc, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return { serviceBreakdown, unmatchedCount, unmatchedRevenue, totalRevenue, topDescriptions };
  };

  const serviceLineData = generateServiceLineBreakdown();

  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6 z-10 relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <p className={`text-3xl font-bold ${colorClass.value}`}>{value}</p>
          </div>
          <div className={`p-3 rounded-full ${colorClass.bg} transition-all duration-300 group-hover:scale-110`}>
            <Icon className={`w-6 h-6 ${colorClass.icon}`} />
          </div>
        </div>
      </CardContent>
      <div className={`absolute inset-0 opacity-5 ${colorClass.bg} group-hover:opacity-10 transition-opacity`}></div>
    </Card>
  );

  const colorMap = {
    blue: { value: "text-blue-600", bg: "bg-blue-100", icon: "text-blue-600" },
    green: { value: "text-green-600", bg: "bg-green-100", icon: "text-green-600" },
    orange: { value: "text-orange-600", bg: "bg-orange-100", icon: "text-orange-600" },
    red: { value: "text-red-600", bg: "bg-red-100", icon: "text-red-600" },
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button onClick={handleSyncFinancials} disabled={syncing} className="bg-brand-green hover:bg-brand-forest">
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Timeframe Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs value={timeframe} onValueChange={setTimeframe}>
          <TabsList>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="quarter">This Quarter</TabsTrigger>
            <TabsTrigger value="year">This Year</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Receivables Aging — top of overview */}
      <ReceivablesAgingTable invoices={invoices} />

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <StatCard
          title={`Total Invoiced (${timeframe === 'month' ? 'This Month' : timeframe === 'quarter' ? 'This Quarter' : timeframe === 'year' ? 'This Year' : 'All Time'})`}
          value={formatCurrency(metrics.totalInvoiced)}
          icon={DollarSign}
          colorClass={colorMap.blue}
        />
        <StatCard
          title="Total Paid (all time)"
          value={formatCurrency(metrics.totalPaid)}
          icon={CheckCircle2}
          colorClass={colorMap.green}
        />
      </div>

      {/* Booked, Not Delivered */}
      <BookedNotDeliveredTile />

      {/* Revenue by Client — collected, all time */}
      <RevenueByClientPanel invoices={invoices} />

      {/* Revenue by Service Line — Invoiced */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-brand-green">Revenue by Service Line — Invoiced</CardTitle>
          <p className="text-sm text-gray-500">Accrual basis by issue date · all statuses</p>
        </CardHeader>
        <CardContent>
          {serviceLineData.serviceBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={serviceLineData.serviceBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="value" name="Amount" fill={CHART_PALETTE[10]} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {serviceLineData.unmatchedCount > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-amber-600">
                    {serviceLineData.unmatchedCount} line item(s) lack a resolvable service category — {serviceLineData.totalRevenue > 0 ? ((serviceLineData.unmatchedRevenue / serviceLineData.totalRevenue) * 100).toFixed(1) : 0}% of total invoiced revenue.
                  </p>
                  <p className="text-xs font-medium text-gray-500">Top unmatched descriptions:</p>
                  <ul className="text-xs text-gray-500 space-y-0.5">
                    {serviceLineData.topDescriptions.map((d, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="truncate mr-2">{d.desc}</span>
                        <span className="font-medium text-gray-600 whitespace-nowrap">{formatCurrency(d.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <DashboardEmptyState icon={DollarSign} message="No service data yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}