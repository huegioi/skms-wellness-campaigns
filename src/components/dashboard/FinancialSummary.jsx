import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, ArrowRight, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const BRAND = { blue: '#013f7c', green: '#264d44', orange: '#e87040' };
const MONTH_ORDER = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_CONFIG = {
  paid:      { color: '#264d44', label: 'Paid' },
  sent:      { color: '#013f7c', label: 'Sent' },
  overdue:   { color: '#e87040', label: 'Overdue' },
  draft:     { color: '#a0aec0', label: 'Draft' },
  cancelled: { color: '#e53e3e', label: 'Cancelled' },
};
const STATUSES = Object.keys(STATUS_CONFIG);

// Safe parse of YYYY-MM-DD without timezone drift
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return null;
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 }; // month 0-indexed
}

export default function FinancialSummary() {
  const { data: rawInvoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 10000),
  });

  const { data: rawExpenses = [] } = useQuery({
    queryKey: ['quickBooksExpenses'],
    queryFn: () => base44.entities.QuickBooksExpense.list(),
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const invoices = rawInvoices.filter(i => !i.is_demo);
  const expenses = rawExpenses.filter(e => !e.is_demo);

  // All-time KPIs
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);
  const outstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total_amount || 0), 0);
  const overdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalPaid - totalExpenses;

  // This month KPIs
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthPaid = invoices
    .filter(i => {
      if (i.status !== 'paid') return false;
      const p = parseDateParts(i.issue_date || i.paid_date);
      return p && p.year === now.getFullYear() && p.month === now.getMonth();
    })
    .reduce((s, i) => s + (i.total_amount || 0), 0);
  const thisMonthExpenses = expenses
    .filter(e => {
      const p = parseDateParts(e.transaction_date);
      return p && p.year === now.getFullYear() && p.month === now.getMonth();
    })
    .reduce((s, e) => s + (e.amount || 0), 0);

  // Last 6 months — stacked by invoice status (same logic as RevenueChart)
  const monthlyMap = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${MONTH_ORDER[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const entry = { month: key, _monthIdx: d.getMonth(), _year: d.getFullYear(), expenses: 0 };
    STATUSES.forEach(s => { entry[s] = 0; });
    monthlyMap[key] = entry;
  }

  invoices.forEach(inv => {
    const parsed = parseDateParts(inv.issue_date || inv.paid_date);
    if (!parsed) return;
    const key = `${MONTH_ORDER[parsed.month]} '${String(parsed.year).slice(2)}`;
    if (!monthlyMap[key]) return;
    const status = STATUSES.includes(inv.status) ? inv.status : 'draft';
    monthlyMap[key][status] += inv.total_amount || 0;
  });

  expenses.forEach(exp => {
    const parsed = parseDateParts(exp.transaction_date);
    if (!parsed) return;
    const key = `${MONTH_ORDER[parsed.month]} '${String(parsed.year).slice(2)}`;
    if (monthlyMap[key]) monthlyMap[key].expenses += exp.amount || 0;
  });

  const chartData = Object.values(monthlyMap);

  // Invoice status breakdown
  const statusCounts = {};
  invoices.forEach(i => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Link to Financials */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: BRAND.blue }}>Financial Overview</h2>
        <Link
          to={createPageUrl('Financials')}
          className="flex items-center gap-1 text-sm font-semibold hover:underline"
          style={{ color: BRAND.green }}
        >
          View Full Financials <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle2} label="Total Revenue (Paid)" value={`$${totalPaid.toLocaleString()}`} color="green" />
        <KpiCard icon={TrendingDown} label="Total Expenses" value={`$${totalExpenses.toLocaleString()}`} color="red" />
        <KpiCard icon={Wallet} label="Net Profit" value={`$${netProfit.toLocaleString()}`} color={netProfit >= 0 ? 'purple' : 'red'} />
        <KpiCard icon={AlertCircle} label="Overdue" value={`$${overdue.toLocaleString()}`} color="orange" />
      </div>

      {/* This Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">This Month — Income</p>
          <p className="text-2xl font-bold text-green-600">${thisMonthPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">This Month — Expenses</p>
          <p className="text-2xl font-bold text-red-500">${thisMonthExpenses.toLocaleString()}</p>
        </div>
      </div>

      {/* Income vs Expenses Chart — stacked by status */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold mb-4" style={{ color: BRAND.blue }}>Invoice Revenue by Status — Last 6 Months</h3>
        {chartData.some(d => STATUSES.some(s => d[s] > 0)) ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4a5568' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#4a5568' }} axisLine={false} tickLine={false} width={46} />
              <Tooltip
                formatter={(value, name) => [`$${value.toLocaleString()}`, STATUS_CONFIG[name]?.label || name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend formatter={name => STATUS_CONFIG[name]?.label || name} />
              {STATUSES.map((status, i) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="a"
                  fill={STATUS_CONFIG[status].color}
                  radius={i === STATUSES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-gray-300 text-sm">No data yet</div>
        )}
      </div>

      {/* Outstanding */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 font-medium">Outstanding Invoices</p>
          <p className="text-2xl font-bold text-amber-600">${outstanding.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{invoices.filter(i => ['sent','overdue'].includes(i.status)).length} invoice(s) pending payment</p>
        </div>
        <Link
          to={createPageUrl('Financials')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: BRAND.green }}
        >
          Manage Invoices <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  const colors = {
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  val: 'text-green-700'  },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    val: 'text-red-600'    },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', val: 'text-purple-700' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-500', val: 'text-orange-600' },
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   val: 'text-blue-700'   },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.bg}`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold ${c.val}`}>{value}</p>
    </div>
  );
}