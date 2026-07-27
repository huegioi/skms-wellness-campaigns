import React, { useState } from 'react';
import { useDashInvoices } from './useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_PALETTE, formatCurrency } from '@/lib/dashboardStyle';
import DashboardSkeleton from './DashboardSkeleton';
import DashboardEmptyState from './DashboardEmptyState';
import TopCustomersCard from './TopCustomersCard';
import ReceivablesAgingTable from '@/components/financials/ReceivablesAgingTable';
import RevenueConcentrationPanel from '@/components/financials/RevenueConcentrationPanel';
import BookedNotDeliveredTile from '@/components/financials/BookedNotDeliveredTile';

export default function FinancialInformationSection() {
  const [timeframe, setTimeframe] = useState('year');
  const [syncing, setSyncing] = useState(false);

  const { data: rawInvoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useDashInvoices();

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
      const d = inv.paid_date || inv.issue_date;
      return d && new Date(d) >= startDate;
    });

    const totalInvoiced = periodInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const outstanding = invoices.filter(inv => ['sent', 'overdue', 'created_in_quickbooks'].includes(inv.status)).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const dueSoon = invoices.filter(inv => {
      if (!['sent', 'created_in_quickbooks'].includes(inv.status)) return false;
      const dueDate = new Date(inv.due_date);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue >= 0;
    }).length;

    return { totalInvoiced, totalPaid, outstanding, dueSoon };
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

  // Generate income breakdown from invoices
  const generateIncomeBreakdown = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startDate = timeframe === 'month' ? startOfMonth : timeframe === 'quarter' ? startOfQuarter : timeframe === 'year' ? startOfYear : new Date(0);

    const periodInvoices = invoices.filter(inv => {
      if (inv.status !== 'paid') return false;
      const d = inv.paid_date || inv.issue_date;
      return d && new Date(d) >= startDate;
    });

    const byCustomer = {};
    const byService = {};

    periodInvoices.forEach(inv => {
      const customer = inv.client_name || inv.company || 'Unknown';
      byCustomer[customer] = (byCustomer[customer] || 0) + (inv.total_amount || 0);

      if (inv.line_items && Array.isArray(inv.line_items)) {
        inv.line_items.forEach(item => {
          const service = item.description || 'General';
          byService[service] = (byService[service] || 0) + (item.amount || 0);
        });
      }
    });

    const topCustomers = Object.entries(byCustomer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    const serviceBreakdown = Object.entries(byService)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    return { topCustomers, serviceBreakdown, typeBreakdown: [] };
  };

  const incomeData = generateIncomeBreakdown();

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title={`Total Invoiced (${timeframe === 'month' ? 'This Month' : 'This Quarter'})`}
          value={formatCurrency(metrics.totalInvoiced)}
          icon={DollarSign}
          colorClass={colorMap.blue}
        />
        <StatCard
          title="Total Paid"
          value={formatCurrency(metrics.totalPaid)}
          icon={CheckCircle2}
          colorClass={colorMap.green}
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(metrics.outstanding)}
          icon={TrendingUp}
          colorClass={colorMap.orange}
        />
        <StatCard
          title="Due Soon (7 days)"
          value={metrics.dueSoon}
          icon={Clock}
          colorClass={colorMap.red}
        />
      </div>

      {/* Booked, Not Delivered */}
      <BookedNotDeliveredTile />

      {/* Top Customers (merged revenue + LTV) */}
      <TopCustomersCard
        incomeData={incomeData}
        invoices={invoices}
        timeframe={timeframe}
      />

      {/* Revenue Concentration */}
      <RevenueConcentrationPanel invoices={invoices} />

      {/* Income by Service/Product */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-brand-green">Income by Service/Product</CardTitle>
        </CardHeader>
        <CardContent>
          {incomeData.serviceBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={incomeData.serviceBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Bar dataKey="value" name="Amount" fill={CHART_PALETTE[10]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <DashboardEmptyState icon={DollarSign} message="No service data yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}