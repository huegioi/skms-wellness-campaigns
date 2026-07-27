import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/dashboardStyle';
import { format } from 'date-fns';

const OUTSTANDING_STATUSES = ['sent', 'overdue', 'created_in_quickbooks'];

export default function ReceivablesAgingTable({ invoices }) {
  const { buckets, oldInvoices, noDueDateInvoices, grandTotal } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allOutstanding = invoices.filter(inv =>
      OUTSTANDING_STATUSES.includes(inv.status)
    );

    const b = {
      current: { count: 0, total: 0 },
      '1-30': { count: 0, total: 0 },
      '31-60': { count: 0, total: 0 },
      '61-90': { count: 0, total: 0 },
      '90+': { count: 0, total: 0 },
      'no_due_date': { count: 0, total: 0 },
    };

    const old = [];
    const noDue = [];

    allOutstanding.forEach(inv => {
      if (!inv.due_date) {
        b['no_due_date'].count++;
        b['no_due_date'].total += inv.total_amount || 0;
        noDue.push(inv);
        return;
      }

      const dueDate = new Date(inv.due_date);
      if (isNaN(dueDate.getTime())) {
        b['no_due_date'].count++;
        b['no_due_date'].total += inv.total_amount || 0;
        noDue.push(inv);
        return;
      }

      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      let bucket;
      if (daysOverdue <= 0) bucket = 'current';
      else if (daysOverdue <= 30) bucket = '1-30';
      else if (daysOverdue <= 60) bucket = '31-60';
      else if (daysOverdue <= 90) bucket = '61-90';
      else bucket = '90+';

      b[bucket].count++;
      b[bucket].total += inv.total_amount || 0;

      if (bucket === '61-90' || bucket === '90+') {
        old.push({ ...inv, daysOverdue: Math.max(daysOverdue, 0), bucket });
      }
    });

    old.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const grandTotal = Object.values(b).reduce(
      (acc, bucket) => ({ count: acc.count + bucket.count, total: acc.total + bucket.total }),
      { count: 0, total: 0 }
    );

    return { buckets: b, oldInvoices: old, noDueDateInvoices: noDue, grandTotal };
  }, [invoices]);

  const bucketLabels = [
    { key: 'current', label: 'Current', sublabel: 'not yet due', color: 'text-green-600' },
    { key: '1-30', label: '1–30 days', sublabel: 'overdue', color: 'text-amber-600' },
    { key: '31-60', label: '31–60 days', sublabel: 'overdue', color: 'text-orange-600' },
    { key: '61-90', label: '61–90 days', sublabel: 'overdue', color: 'text-red-600' },
    { key: '90+', label: '90+ days', sublabel: 'overdue', color: 'text-red-700' },
    { key: 'no_due_date', label: 'No due date', sublabel: 'cannot be chased', color: 'text-amber-600' },
  ];

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-brand-green flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Receivables Aging
        </CardTitle>
        <p className="text-sm text-gray-500">
          Outstanding invoices (sent, overdue, in QuickBooks) aged by due date
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 mb-4">
          {bucketLabels.map(({ key, label, sublabel, color }) => (
            <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs font-medium text-gray-600">{label}</p>
              <p className="text-xs text-gray-400 mb-1">{sublabel}</p>
              <p className={`text-lg font-bold ${color}`}>{formatCurrency(buckets[key].total)}</p>
              <p className="text-xs text-gray-400">{buckets[key].count} invoice{buckets[key].count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>

        {/* Grand total — this is the Outstanding figure */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200 mt-2">
          <div>
            <span className="text-sm font-semibold text-gray-700">Outstanding (all buckets)</span>
            <span className="text-xs text-gray-400 ml-2">{grandTotal.count} invoice{grandTotal.count !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-lg font-bold text-brand-navy">{formatCurrency(grandTotal.total)}</span>
        </div>

        {oldInvoices.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              61+ Days Overdue ({oldInvoices.length})
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide border-b">
                  <div className="col-span-2">Invoice #</div>
                  <div className="col-span-4">Client</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-2 text-right">Due Date</div>
                  <div className="col-span-2 text-right">Days Overdue</div>
                </div>
                <div className="space-y-1 mt-1">
                  {oldInvoices.map(inv => (
                    <div key={inv.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="col-span-2">
                        <span className="font-medium text-gray-900 text-sm">{inv.invoice_number || `INV-${inv.id.slice(0, 8)}`}</span>
                      </div>
                      <div className="col-span-4 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{inv.client_name || inv.company || '—'}</p>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-bold text-sm text-gray-900">{formatCurrency(inv.total_amount)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm text-gray-500">{format(new Date(inv.due_date), 'MMM d, yy')}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <Badge className={inv.bucket === '90+' ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-orange-100 text-orange-700 border border-orange-300'}>
                          {inv.daysOverdue}d
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No invoices 61+ days overdue</p>
        )}

        {noDueDateInvoices.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-amber-600 mb-2">
              No Due Date ({noDueDateInvoices.length})
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide border-b">
                  <div className="col-span-3">Invoice #</div>
                  <div className="col-span-5">Client</div>
                  <div className="col-span-4 text-right">Amount</div>
                </div>
                <div className="space-y-1 mt-1">
                  {noDueDateInvoices.map(inv => (
                    <div key={inv.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                      <div className="col-span-3">
                        <span className="font-medium text-gray-900 text-sm">{inv.invoice_number || `INV-${inv.id.slice(0, 8)}`}</span>
                      </div>
                      <div className="col-span-5 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{inv.client_name || inv.company || '—'}</p>
                      </div>
                      <div className="col-span-4 text-right">
                        <span className="font-bold text-sm text-gray-900">{formatCurrency(inv.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}