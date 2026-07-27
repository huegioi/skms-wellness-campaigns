import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_PALETTE, formatCurrency } from '@/lib/dashboardStyle';

export default function RevenueConcentrationPanel({ invoices }) {
  const { rows, totalRevenue, top3Share } = useMemo(() => {
    const byClient = {};
    let total = 0;

    invoices.forEach(inv => {
      const name = inv.client_name || inv.company || 'Unknown';
      const amount = inv.total_amount || 0;
      byClient[name] = (byClient[name] || 0) + amount;
      total += amount;
    });

    const sorted = Object.entries(byClient)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    const top5 = sorted.slice(0, 5);
    const othersTotal = sorted.slice(5).reduce((s, r) => s + r.value, 0);
    const othersPct = total > 0 ? (othersTotal / total) * 100 : 0;

    const allRows = [...top5];
    if (othersTotal > 0) {
      allRows.push({ name: 'All others', value: othersTotal, pct: othersPct });
    }

    const top3 = sorted.slice(0, 3).reduce((s, r) => s + r.pct, 0);

    return { rows: allRows, totalRevenue: total, top3Share: top3 };
  }, [invoices]);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-brand-green">
          Revenue Concentration
        </CardTitle>
        <p className="text-sm text-gray-500">
          Share of total invoiced revenue (accrual, all statuses) · Top 3 clients = {top3Share.toFixed(1)}% of revenue
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={row.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-green/10 text-brand-green text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-gray-800 truncate">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-gray-500 text-xs">{row.pct.toFixed(1)}%</span>
                    <span className="font-bold text-gray-900">{formatCurrency(row.value)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${row.pct}%`,
                      backgroundColor: idx < 5 ? CHART_PALETTE[idx % CHART_PALETTE.length] : '#94a3b8',
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t mt-2">
              <span className="text-sm font-semibold text-gray-700">Total Invoiced</span>
              <span className="text-sm font-bold text-brand-navy">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No invoice data</p>
        )}
      </CardContent>
    </Card>
  );
}