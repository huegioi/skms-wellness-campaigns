import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CheckCircle2, RefreshCw, TrendingDown, Wallet } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ReportsSection from './ReportsSection';
import ExpenseManager from './ExpenseManager';

export default function FinancialInformationSection() {
  const [timeframe, setTimeframe] = useState('month');
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

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

  // Generate expense breakdown by sub-category
  const generateExpenseBreakdown = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startDate = timeframe === 'month' ? startOfMonth : startOfQuarter;

    const periodExpenses = expenses.filter(exp => 
      new Date(exp.transaction_date) >= startDate
    );

    const breakdown = {};
    const contractorTotal = { total: 0, count: 0 };

    periodExpenses.forEach(exp => {
      const subCat = exp.sub_category || exp.category || 'Uncategorized';
      if (!breakdown[subCat]) breakdown[subCat] = 0;
      breakdown[subCat] += exp.amount || 0;

      // Track contractor spending
      if (subCat.toLowerCase().includes('contractor') || 
          exp.vendor_name?.toLowerCase().includes('contractor')) {
        contractorTotal.total += exp.amount || 0;
        contractorTotal.count += 1;
      }
    });

    const sorted = Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    return { breakdown: sorted, contractorTotal };
  };

  // Generate income breakdown by customer
  const generateIncomeBreakdown = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startDate = timeframe === 'month' ? startOfMonth : startOfQuarter;

    const periodIncome = income.filter(inc => 
      new Date(inc.transaction_date) >= startDate
    );

    const byCustomer = {};
    const byService = {};
    const byType = {};

    periodIncome.forEach(inc => {
      const customer = inc.customer_name || 'Unknown';
      const service = inc.service_line || 'General';
      const type = inc.transaction_type || 'Other';

      byCustomer[customer] = (byCustomer[customer] || 0) + (inc.amount || 0);
      byService[service] = (byService[service] || 0) + (inc.amount || 0);
      byType[type] = (byType[type] || 0) + (inc.amount || 0);
    });

    const topCustomers = Object.entries(byCustomer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    const serviceBreakdown = Object.entries(byService)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const typeBreakdown = Object.entries(byType)
      .map(([name, value]) => ({ name, value }));

    return { topCustomers, serviceBreakdown, typeBreakdown };
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
            {syncing ? 'Syncing...' : 'Sync QuickBooks'}
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

      {/* Expense & Income Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Contractor & Major Expenses */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Major Expense Categories</CardTitle>
            {expenseData.contractorTotal.total > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Contractor Spending: <span className="font-semibold text-red-600">${expenseData.contractorTotal.total.toLocaleString()}</span> ({expenseData.contractorTotal.count} transactions)
              </p>
            )}
          </CardHeader>
          <CardContent>
            {expenseData.breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={expenseData.breakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="value" name="Amount" fill="#F44336" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No expense data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income by Customer */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Top Income Sources (by Customer)</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeData.topCustomers.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={incomeData.topCustomers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="value" name="Amount" fill="#4CAF50" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No income data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Chart */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Income vs Expenses (Last 6 Months)</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => `$${value.toLocaleString()}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#4CAF50" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#F44336" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No financial data yet. Click "Sync QuickBooks" to load data.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Income Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Income by Service Line */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Income by Service/Product</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeData.serviceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={incomeData.serviceBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="value" name="Amount" fill="#9C27B0" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No service data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income by Transaction Type */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Income by Transaction Type</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeData.typeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={incomeData.typeBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="value" name="Amount" fill="#FF9800" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No transaction type data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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