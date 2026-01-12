import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CheckCircle2, RefreshCw, TrendingDown, Wallet } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function FinancialInformationSection() {
  const [timeframe, setTimeframe] = useState('month');
  const [syncing, setSyncing] = useState(false);

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ['qbExpenses'],
    queryFn: () => base44.entities.QuickBooksExpense.list()
  });

  const { data: income = [], refetch: refetchIncome } = useQuery({
    queryKey: ['qbIncome'],
    queryFn: () => base44.entities.QuickBooksIncome.list()
  });

  const calculateMetrics = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startDate = timeframe === 'month' ? startOfMonth : startOfQuarter;

    const periodInvoices = invoices.filter(inv => 
      new Date(inv.created_date) >= startDate
    );

    const periodExpenses = expenses.filter(exp => 
      new Date(exp.transaction_date) >= startDate
    );

    const periodIncome = income.filter(inc => 
      new Date(inc.transaction_date) >= startDate
    );

    const totalInvoiced = periodInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const outstanding = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    
    const dueSoon = invoices.filter(inv => {
      if (inv.status !== 'sent') return false;
      const dueDate = new Date(inv.due_date);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue >= 0;
    }).length;

    const totalExpenses = periodExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalIncome = periodIncome.reduce((sum, inc) => sum + (inc.amount || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    return { totalInvoiced, totalPaid, outstanding, dueSoon, totalExpenses, totalIncome, netProfit };
  };

  const metrics = calculateMetrics();

  const handleSyncFinancials = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        base44.functions.invoke('syncQuickBooksExpenses', {}),
        base44.functions.invoke('syncQuickBooksIncome', {})
      ]);
      await Promise.all([refetchExpenses(), refetchIncome()]);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const generateMonthlyData = () => {
    const monthlyData = {};
    
    expenses.forEach(exp => {
      const month = new Date(exp.transaction_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyData[month]) monthlyData[month] = { month, expenses: 0, income: 0 };
      monthlyData[month].expenses += exp.amount || 0;
    });

    income.forEach(inc => {
      const month = new Date(inc.transaction_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyData[month]) monthlyData[month] = { month, expenses: 0, income: 0 };
      monthlyData[month].income += inc.amount || 0;
    });

    return Object.values(monthlyData).slice(-6).map(data => ({
      ...data,
      profit: data.income - data.expenses
    }));
  };

  const monthlyData = generateMonthlyData();

  const StatCard = ({ title, value, icon: Icon, trend, color = "text-gray-600" }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {trend && (
              <p className="text-sm text-gray-500 mt-1">{trend}</p>
            )}
          </div>
          <div className={`p-4 rounded-full ${color.replace('text', 'bg').replace('600', '100')}`}>
            <Icon className={`w-8 h-8 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Timeframe Selector and Sync Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={timeframe} onValueChange={setTimeframe}>
          <TabsList>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="quarter">This Quarter</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={handleSyncFinancials} disabled={syncing} className="bg-[#264d44] hover:bg-[#1a3830]">
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync QuickBooks'}
        </Button>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={`Total Invoiced (${timeframe === 'month' ? 'This Month' : 'This Quarter'})`}
          value={`$${metrics.totalInvoiced.toLocaleString()}`}
          icon={DollarSign}
          color="text-blue-600"
        />
        <StatCard
          title="Total Paid"
          value={`$${metrics.totalPaid.toLocaleString()}`}
          icon={CheckCircle2}
          color="text-green-600"
        />
        <StatCard
          title="Outstanding"
          value={`$${metrics.outstanding.toLocaleString()}`}
          icon={TrendingUp}
          color="text-orange-600"
        />
        <StatCard
          title="Due Soon (7 days)"
          value={metrics.dueSoon}
          icon={Clock}
          color="text-red-600"
        />
      </div>

      {/* Income vs Expenses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Income</p>
                <p className="text-3xl font-bold text-green-600">${metrics.totalIncome.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-full bg-green-100">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Expenses</p>
                <p className="text-3xl font-bold text-red-600">${metrics.totalExpenses.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-full bg-red-100">
                <TrendingDown className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Net Profit</p>
                <p className={`text-3xl font-bold ${metrics.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  ${metrics.netProfit.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-full bg-purple-100">
                <Wallet className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Income vs Expenses (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22C55E" />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No financial data yet. Click "Sync QuickBooks" to load data.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profit Trend */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Net Profit Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#7c3aed" strokeWidth={3} dot={{ fill: '#7c3aed', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">No data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}