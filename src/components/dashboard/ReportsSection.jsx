import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Download, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#264d44', '#22C55E', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

export default function ReportsSection() {
  const [reportType, setReportType] = useState('pl');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');

  const { data: expenses = [] } = useQuery({
    queryKey: ['qbExpenses'],
    queryFn: () => base44.entities.QuickBooksExpense.list()
  });

  const { data: income = [] } = useQuery({
    queryKey: ['qbIncome'],
    queryFn: () => base44.entities.QuickBooksIncome.list()
  });

  // Extract unique values for filters
  const accountTypes = useMemo(() => {
    const accounts = new Set();
    expenses.forEach(exp => exp.account_name && accounts.add(exp.account_name));
    income.forEach(inc => inc.deposit_account && accounts.add(inc.deposit_account));
    return Array.from(accounts).sort();
  }, [expenses, income]);

  const clients = useMemo(() => {
    const clientSet = new Set();
    income.forEach(inc => inc.customer_name && clientSet.add(inc.customer_name));
    return Array.from(clientSet).sort();
  }, [income]);

  // Filter data based on selections
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = new Date(exp.transaction_date);
      const matchesDate = (!startDate || expDate >= new Date(startDate)) && 
                         (!endDate || expDate <= new Date(endDate));
      const matchesAccount = selectedAccount === 'all' || exp.account_name === selectedAccount;
      return matchesDate && matchesAccount;
    });
  }, [expenses, startDate, endDate, selectedAccount]);

  const filteredIncome = useMemo(() => {
    return income.filter(inc => {
      const incDate = new Date(inc.transaction_date);
      const matchesDate = (!startDate || incDate >= new Date(startDate)) && 
                         (!endDate || incDate <= new Date(endDate));
      const matchesAccount = selectedAccount === 'all' || inc.deposit_account === selectedAccount;
      const matchesClient = selectedClient === 'all' || inc.customer_name === selectedClient;
      return matchesDate && matchesAccount && matchesClient;
    });
  }, [income, startDate, endDate, selectedAccount, selectedClient]);

  // Calculate P&L Statement
  const profitLossData = useMemo(() => {
    const totalRevenue = filteredIncome.reduce((sum, inc) => sum + (inc.amount || 0), 0);
    
    const expensesByCategory = {};
    const expensesBySubCategory = {};
    
    filteredExpenses.forEach(exp => {
      const category = exp.category || 'Uncategorized';
      const subCategory = exp.sub_category;
      
      // Main category
      expensesByCategory[category] = (expensesByCategory[category] || 0) + (exp.amount || 0);
      
      // Sub-category breakdown
      if (subCategory) {
        const key = `${category} - ${subCategory}`;
        expensesBySubCategory[key] = (expensesBySubCategory[key] || 0) + (exp.amount || 0);
      }
    });

    const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      revenue: totalRevenue,
      expenses: expensesByCategory,
      expensesBySubCategory,
      totalExpenses,
      netIncome,
      netMargin: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : 0
    };
  }, [filteredIncome, filteredExpenses]);

  // Calculate Balance Sheet
  const balanceSheetData = useMemo(() => {
    const accountBalances = {};
    
    filteredIncome.forEach(inc => {
      const account = inc.deposit_account || 'Uncategorized';
      accountBalances[account] = (accountBalances[account] || 0) + (inc.amount || 0);
    });

    filteredExpenses.forEach(exp => {
      const account = exp.account_name || 'Uncategorized';
      accountBalances[account] = (accountBalances[account] || 0) - (exp.amount || 0);
    });

    const assets = Object.entries(accountBalances)
      .filter(([_, balance]) => balance > 0)
      .reduce((sum, [_, balance]) => sum + balance, 0);

    const liabilities = Math.abs(Object.entries(accountBalances)
      .filter(([_, balance]) => balance < 0)
      .reduce((sum, [_, balance]) => sum + balance, 0));

    return {
      accounts: accountBalances,
      totalAssets: assets,
      totalLiabilities: liabilities,
      equity: assets - liabilities
    };
  }, [filteredIncome, filteredExpenses]);

  // Calculate Cash Flow
  const cashFlowData = useMemo(() => {
    const operatingCashFlow = filteredIncome.reduce((sum, inc) => sum + (inc.amount || 0), 0) -
                              filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const monthlyFlow = {};
    
    filteredIncome.forEach(inc => {
      const month = new Date(inc.transaction_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyFlow[month]) monthlyFlow[month] = { month, inflow: 0, outflow: 0 };
      monthlyFlow[month].inflow += inc.amount || 0;
    });

    filteredExpenses.forEach(exp => {
      const month = new Date(exp.transaction_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyFlow[month]) monthlyFlow[month] = { month, inflow: 0, outflow: 0 };
      monthlyFlow[month].outflow += exp.amount || 0;
    });

    return {
      operatingCashFlow,
      monthlyFlow: Object.values(monthlyFlow).map(m => ({ ...m, netFlow: m.inflow - m.outflow }))
    };
  }, [filteredIncome, filteredExpenses]);

  // Expense breakdown by category
  const expenseChartData = useMemo(() => {
    const categoryData = {};
    filteredExpenses.forEach(exp => {
      const category = exp.category || 'Uncategorized';
      categoryData[category] = (categoryData[category] || 0) + (exp.amount || 0);
    });
    return Object.entries(categoryData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Income breakdown by source
  const incomeChartData = useMemo(() => {
    const sourceData = {};
    filteredIncome.forEach(inc => {
      const source = inc.customer_name || 'Unknown';
      sourceData[source] = (sourceData[source] || 0) + (inc.amount || 0);
    });
    return Object.entries(sourceData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 clients
  }, [filteredIncome]);

  const handleExport = () => {
    // Simple export to console - could be enhanced to CSV/PDF
    console.log('Exporting report:', reportType);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accountTypes.map(account => (
                    <SelectItem key={account} value={account}>{account}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs value={reportType} onValueChange={setReportType}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
            <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          </TabsList>
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* P&L Statement */}
        <TabsContent value="pl" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ color: '#264d44' }}>Profit & Loss Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Total Revenue</span>
                    <span className="font-bold text-lg text-green-600">
                      ${profitLossData.revenue.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="border-b pb-3">
                  <div className="font-bold text-lg mb-3">Operating Expenses</div>
                  {Object.entries(profitLossData.expenses).map(([category, amount]) => (
                    <div key={category}>
                      <div className="flex justify-between py-2 pl-4">
                        <span className="text-gray-700 font-medium">{category}</span>
                        <span className="text-gray-900">${amount.toLocaleString()}</span>
                      </div>
                      {/* Show sub-categories under each main category */}
                      {Object.entries(profitLossData.expensesBySubCategory)
                        .filter(([key]) => key.startsWith(`${category} - `))
                        .map(([key, subAmount]) => {
                          const subCat = key.split(' - ')[1];
                          return (
                            <div key={key} className="flex justify-between py-1 pl-8">
                              <span className="text-gray-500 text-sm">• {subCat}</span>
                              <span className="text-gray-600 text-sm">${subAmount.toLocaleString()}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 pl-4 font-semibold">
                    <span>Total Expenses</span>
                    <span className="text-red-600">${profitLossData.totalExpenses.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-xl">Net Income</span>
                    <span className={`font-bold text-xl ${profitLossData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${profitLossData.netIncome.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Net Margin</span>
                    <span>{profitLossData.netMargin}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {expenseChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.name}: $${entry.value.toLocaleString()}`}
                      >
                        {expenseChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No expense data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Income by Client (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                {incomeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={incomeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      <Bar dataKey="value" fill="#22C55E" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No income data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ color: '#264d44' }}>Balance Sheet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <div className="font-bold text-lg mb-3">Assets</div>
                  {Object.entries(balanceSheetData.accounts)
                    .filter(([_, balance]) => balance > 0)
                    .map(([account, balance]) => (
                      <div key={account} className="flex justify-between py-2 pl-4">
                        <span className="text-gray-700">{account}</span>
                        <span className="text-gray-900">${balance.toLocaleString()}</span>
                      </div>
                    ))}
                  <div className="flex justify-between pt-2 pl-4 font-semibold">
                    <span>Total Assets</span>
                    <span className="text-green-600">${balanceSheetData.totalAssets.toLocaleString()}</span>
                  </div>
                </div>

                <div className="border-b pb-3">
                  <div className="font-bold text-lg mb-3">Liabilities</div>
                  {Object.entries(balanceSheetData.accounts)
                    .filter(([_, balance]) => balance < 0)
                    .map(([account, balance]) => (
                      <div key={account} className="flex justify-between py-2 pl-4">
                        <span className="text-gray-700">{account}</span>
                        <span className="text-gray-900">${Math.abs(balance).toLocaleString()}</span>
                      </div>
                    ))}
                  <div className="flex justify-between pt-2 pl-4 font-semibold">
                    <span>Total Liabilities</span>
                    <span className="text-red-600">${balanceSheetData.totalLiabilities.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xl">Owner's Equity</span>
                    <span className={`font-bold text-xl ${balanceSheetData.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${balanceSheetData.equity.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow Statement */}
        <TabsContent value="cashflow" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle style={{ color: '#264d44' }}>Cash Flow Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xl">Operating Cash Flow</span>
                    <span className={`font-bold text-xl ${cashFlowData.operatingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${cashFlowData.operatingCashFlow.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              {cashFlowData.monthlyFlow.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={cashFlowData.monthlyFlow}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="inflow" name="Cash Inflow" fill="#22C55E" />
                    <Bar dataKey="outflow" name="Cash Outflow" fill="#EF4444" />
                    <Bar dataKey="netFlow" name="Net Cash Flow" fill="#264d44" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-gray-400">
                  No cash flow data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}