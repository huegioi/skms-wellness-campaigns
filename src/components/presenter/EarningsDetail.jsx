import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';

const COLLAPSE_THRESHOLD = 10;

export default function EarningsDetail({ past = [], earnings }) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    return past
      .filter(e => e.completed && e.session_fee != null)
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  }, [past]);

  if (rows.length === 0) return null;

  const visibleRows = expanded || rows.length <= COLLAPSE_THRESHOLD ? rows : rows.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = rows.length - visibleRows.length;

  const fmtMoney = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
            <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Session</th>
            <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Fee</th>
            <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visibleRows.map((e) => {
            const start = parseISO(e.start_date);
            const isPaid = !!e.presenter_paid;
            return (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">{format(start, 'MMM d, yyyy')}</td>
                <td className="py-2.5 pr-4 text-gray-700">{e.client_name || '—'}</td>
                <td className="py-2.5 pr-4 text-gray-700">{e.title || '—'}</td>
                <td className="py-2.5 pr-4 text-right font-medium text-gray-700">${fmtMoney(e.session_fee)}</td>
                <td className="py-2.5 text-center">
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                    isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isPaid ? 'Paid' : 'Pending'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200">
            <td colSpan={3} className="pt-3 font-semibold text-gray-700">Total</td>
            <td className="pt-3 pr-4 text-right">
              <span className="block text-xs font-normal text-amber-600">Pending ${fmtMoney(earnings?.total_pending)}</span>
              <span className="block text-xs font-normal text-green-600">Paid ${fmtMoney(earnings?.total_paid)}</span>
            </td>
            <td className="pt-3 text-right font-bold text-gray-800 text-base">
              ${fmtMoney((earnings?.total_pending || 0) + (earnings?.total_paid || 0))}
            </td>
          </tr>
        </tfoot>
      </table>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 flex items-center gap-1.5 text-sm text-[#013f7c] font-medium hover:underline"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}