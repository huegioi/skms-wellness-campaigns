import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CheckCircle2, RefreshCw, TrendingDown, Wallet } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ReportsSection from './ReportsSection';
import CustomerLTVCard from './CustomerLTVCard';
import ExpenseManager from './ExpenseManager';

function TopIncomeSourcesCard({ incomeData, invoices, timeframe }) {
  const totalIncome = incomeData.topCustomers.reduce((s, c) => s + c.value, 0);
  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle style={{ color: '#264d44' }}>Top Income Sources by Customer</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
        {timeframe === 'month' ? 'This Month' : timeframe === 'quarter' ? 'This Quarter' : timeframe === 'year' ? 'This Year' : 'All Time'} &mdash; paid invoices only
        </p>
      </CardHeader>
      <CardContent>
        {incomeData.topCustomers.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={incomeData.topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Bar dataKey="value" name="Revenue" fill="#264d44" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {incomeData.topCustomers.map((customer, idx) => {
                const pct = totalIncome > 0 ? ((customer.value / totalIncome) * 100).toFixed(1) : 0;
                const customerInvoices = invoices.filter(inv =>
                  inv.status === 'paid' &&
                  (inv.client_name === customer.name || inv.company === customer.name)
                );
                const invoiceCount = customerInvoices.length;
                const avgInvoice = invoiceCount > 0 ? customer.value / invoiceCount : 0;
                return (
                  <div key={customer.name} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#264d44] text-white text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-800 truncate text-sm">{customer.name}</p>
                        <p className="font-bold text-[#264d44] flex-shrink-0">${customer.value.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}</span>
                        <span>Avg: ${Math.round(avgInvoice).toLocaleString()}</span>
                        <span className="ml-auto font-medium text-gray-600">{pct}% of total</span>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#264d44] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-400">No income data for this period</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FinancialInformationSection() {
  const [timeframe, setTimeframe] = useState('year');
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const { data: quickBooksExpenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ['quickBooksExpenses'],
    queryFn: () => base44.entities.QuickBooksExpense.list(),
  });

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
    const outstanding = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    
    const dueSoon = invoices.filter(inv => {
      if (inv.status !== 'sent') return false;
      const dueDate = new Date(inv.due_date);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue >= 0;
    }).length;

    // Income: paid invoices in period, using paid_date || issue_date
    const paidInvoices = invoices.filter(inv => {
      if (inv.status !== 'paid') return false;
      const d = inv.paid_date || inv.issue_date;
      return d && new Date(d) >= startDate;
    });
    const totalIncome = paidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const totalExpenses = quickBooksExpenses
      .filter(exp => exp.transaction_date && new Date(exp.transaction_date) >= startDate)
      .reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const netProfit = totalIncome - totalExpenses;

    return { totalInvoiced, totalPaid, outstanding, dueSoon, totalExpenses, totalIncome, netProfit };
  };

  const metrics = calculateMetrics();

  const handleSyncFinancials = async () => {
    setSyncing(true);
    try {
      await refetchInvoices();
      await refetchExpenses();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const generateMonthlyData = () => {
    const monthlyData = {};

    const getKey = (dateStr) => {
      // Parse date parts directly to avoid UTC/local timezone shifting
      const parts = dateStr.split('T')[0].split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { key, label };
    };

    // Track paid invoices as income — use paid_date if available, fall back to issue_date
    invoices.filter(inv => inv.status === 'paid' && (inv.paid_date || inv.issue_date)).forEach(inv => {
      const { key, label } = getKey(inv.paid_date || inv.issue_date);
      if (!monthlyData[key]) monthlyData[key] = { key, month: label, expenses: 0, income: 0 };
      monthlyData[key].income += inv.total_amount || 0;
    });

    // Track expenses
    quickBooksExpenses.filter(exp => exp.transaction_date).forEach(exp => {
      const { key, label } = getKey(exp.transaction_date);
      if (!monthlyData[key]) monthlyData[key] = { key, month: label, expenses: 0, income: 0 };
      monthlyData[key].expenses += exp.amount || 0;
    });

    return Object.values(monthlyData)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6)
      .map(data => ({ ...data, profit: data.income - data.expenses }));
  };

  const monthlyData = generateMonthlyData();

  const generateExpenseBreakdown = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startDate = timeframe === 'month' ? startOfMonth : timeframe === 'quarter' ? startOfQuarter : timeframe === 'year' ? startOfYear : new Date(0);

    const periodExpenses = quickBooksExpenses.filter(exp =>
      exp.transaction_date && new Date(exp.transaction_date) >= startDate
    );

    const categoryBreakdown = {};
    let contractorTotalAmount = 0;
    let contractorTotalCount = 0;

    periodExpenses.forEach(exp => {
      const category = exp.category || 'Other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + (exp.amount || 0);

      if (exp.vendor_name && exp.vendor_name.toLowerCase().includes('contractor')) {
        contractorTotalAmount += exp.amount || 0;
        contractorTotalCount++;
      }
    });

    const breakdown = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    return { breakdown, contractorTotal: { total: contractorTotalAmount, count: contractorTotalCount } };
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

  const expenseData = generateExpenseBreakdown();
  const incomeData = generateIncomeBreakdown();

  const StatCard = ({ title, value, icon: Icon, trend, colorClass }) => (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6 z-10 relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <p className={`text-3xl font-bold ${colorClass.value}`}>{value}</p>
            {trend && (
              <p className="text-sm text-gray-500 mt-1">{trend}</p>
            )}
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
    purple: { value: "text-purple-600", bg: "bg-purple-100", icon: "text-purple-600" },
  };

  return (
    <div className="space-y-8">
      {/* Main Tabs: Overview and Reports */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="expenses">Manage Expenses</TabsTrigger>
          </TabsList>
          <Button onClick={handleSyncFinancials} disabled={syncing} className="bg-[#264d44] hover:bg-[#1a3830]">
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-8">
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

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title={`Total Invoiced (${timeframe === 'month' ? 'This Month' : 'This Quarter'})`}
          value={`$${metrics.totalInvoiced.toLocaleString()}`}
          icon={DollarSign}
          colorClass={colorMap.blue}
        />
        <StatCard
          title="Total Paid"
          value={`$${metrics.totalPaid.toLocaleString()}`}
          icon={CheckCircle2}
          colorClass={colorMap.green}
        />
        <StatCard
          title="Outstanding"
          value={`$${metrics.outstanding.toLocaleString()}`}
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

      {/* Income vs Expenses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <CardContent className="p-6 z-10 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Income</p>
                <p className="text-3xl font-bold text-green-600">${metrics.totalIncome.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-full bg-green-100 transition-all duration-300 group-hover:scale-110">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
          <div className="absolute inset-0 opacity-10 bg-green-200 blur-2xl"></div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-100 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <CardContent className="p-6 z-10 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Expenses</p>
                <p className="text-3xl font-bold text-red-600">${metrics.totalExpenses.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-full bg-red-100 transition-all duration-300 group-hover:scale-110">
                <TrendingDown className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </CardContent>
          <div className="absolute inset-0 opacity-10 bg-red-200 blur-2xl"></div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-100 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <CardContent className="p-6 z-10 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Net Profit</p>
                <p className={`text-3xl font-bold ${metrics.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  ${metrics.netProfit.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-full bg-purple-100 transition-all duration-300 group-hover:scale-110">
                <Wallet className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
          <div className="absolute inset-0 opacity-10 bg-purple-200 blur-2xl"></div>
        </Card>
      </div>

      {/* Top Income Sources - Full Width Detailed */}
      <TopIncomeSourcesCard
        incomeData={incomeData}
        invoices={invoices}
        timeframe={timeframe}
      />

      {/* Income vs Expenses Chart */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Income vs Expenses (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#4CAF50" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#F44336" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No financial data yet. Click "Refresh Data" to load data.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Income by Service/Product */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Income by Service/Product</CardTitle>
        </CardHeader>
        <CardContent>
          {incomeData.serviceBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeData.serviceBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Bar dataKey="value" name="Amount" fill="#9C27B0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No service data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profit Trend */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Net Profit Trend</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => `$${value.toLocaleString()}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  name="Net Profit" 
                  stroke="#9C27B0" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#9C27B0', stroke: '#fff', strokeWidth: 2 }} 
                  activeDot={{ r: 6, fill: '#fff', stroke: '#9C27B0', strokeWidth: 2 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">No data available</div>
          )}
        </CardContent>
      </Card>

      {/* Customer Lifetime Value */}
      <CustomerLTVCard invoices={invoices} />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <ReportsSection />
        </TabsContent>

        {/* Expense Manager Tab */}
        <TabsContent value="expenses">
          <ExpenseManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}