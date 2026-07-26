import React from 'react';
import { useDashInvoices, useDashExpenses } from './useDashboardData';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, AlertCircle, Wallet, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/dashboardStyle';
import DashboardSkeleton from './DashboardSkeleton';

// Safe parse of YYYY-MM-DD without timezone drift
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return null;
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 };
}

export default function FinancialSummary() {
  const { data: rawInvoices = [], isLoading: loadingInvoices } = useDashInvoices();
  const { data: rawExpenses = [], isLoading: loadingExpenses } = useDashExpenses();

  // Exclude demo/broker-demo records from dashboard metrics
  const invoices = rawInvoices.filter(i => !i.is_demo);
  const expenses = rawExpenses.filter(e => !e.is_demo);

  // Three stat tiles: revenue, outstanding, net this month
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);
  const outstanding = invoices.filter(i => ['sent', 'overdue', 'created_in_quickbooks'].includes(i.status)).reduce((s, i) => s + (i.total_amount || 0), 0);

  const now = new Date();
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
  const netThisMonth = thisMonthPaid - thisMonthExpenses;

  if (loadingInvoices || loadingExpenses) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-brand-green">Financial Overview</h2>
        <DashboardSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Link to Financials */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-green">Financial Overview</h2>
        <Link
          to={createPageUrl('Financials')}
          className="flex items-center gap-1 text-sm font-semibold text-brand-green hover:underline"
        >
          View Full Financials <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Three stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile icon={CheckCircle2} label="Revenue (Paid)" value={formatCurrency(totalPaid)} color="green" />
        <StatTile icon={AlertCircle} label="Outstanding Invoices" value={formatCurrency(outstanding)} color="orange" />
        <StatTile icon={Wallet} label="Net This Month" value={formatCurrency(netThisMonth)} color={netThisMonth >= 0 ? 'purple' : 'red'} />
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }) {
  const colors = {
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  val: 'text-green-700'  },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-500', val: 'text-orange-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', val: 'text-purple-700' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    val: 'text-red-600'    },
  };
  const c = colors[color] || colors.green;
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