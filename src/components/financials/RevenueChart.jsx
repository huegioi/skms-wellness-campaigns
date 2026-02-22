import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, DollarSign, FileCheck, CalendarRange } from 'lucide-react';

const MONTH_ORDER = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 5 + i);

const BRAND = {
  blue: '#013f7c',
  green: '#264d44',
  orange: '#e87040',
  grey: '#4a5568',
};

const STATUS_CONFIG = {
  paid:    { color: '#264d44', label: 'Paid' },
  sent:    { color: '#013f7c', label: 'Sent' },
  overdue: { color: '#e87040', label: 'Overdue' },
  draft:   { color: '#a0aec0', label: 'Draft' },
  cancelled: { color: '#e53e3e', label: 'Cancelled' },
};
const STATUSES = Object.keys(STATUS_CONFIG);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 min-w-[160px]">
      <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
      {payload.filter(p => p.value > 0).map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: p.fill }} />
            <span className="text-gray-500">{STATUS_CONFIG[p.dataKey]?.label}</span>
          </div>
          <span className="font-semibold text-gray-700">${p.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      ))}
      <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between text-sm">
        <span className="text-gray-500 font-medium">Total</span>
        <span className="font-bold" style={{ color: BRAND.blue }}>${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}

export default function RevenueChart() {
  const [sortOrder, setSortOrder] = useState('chronological');

  // Date range: default to last 2 years
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setFullYear(defaultFrom.getFullYear() - 2);
  const [fromMonth, setFromMonth] = useState(defaultFrom.getMonth());
  const [fromYear, setFromYear] = useState(defaultFrom.getFullYear());
  const [toMonth, setToMonth] = useState(defaultTo.getMonth());
  const [toYear, setToYear] = useState(defaultTo.getFullYear());

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-chart'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 10000),
  });

  const { chartData, totalRevenue, invoiceCount } = useMemo(() => {
    const fromDate = new Date(fromYear, fromMonth, 1);
    const toDate = new Date(toYear, toMonth + 1, 0);

    const filtered = invoices.filter(inv => {
      const dateStr = inv.issue_date || inv.paid_date;
      if (!dateStr) return false;
      const parts = dateStr.split('T')[0].split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d >= fromDate && d <= toDate;
    });

    const byMonth = {};
    filtered.forEach(inv => {
      const dateStr = (inv.issue_date || inv.paid_date || '').split('T')[0];
      const parts = dateStr.split('-');
      if (parts.length < 3) return;
      const monthIdx = parseInt(parts[1]) - 1;
      const year = parseInt(parts[0]);
      const month = MONTH_ORDER[monthIdx];
      const key = `${month} ${year}`;
      if (!byMonth[key]) {
        byMonth[key] = { month: key, monthIndex: monthIdx, year, count: 0 };
        STATUSES.forEach(s => { byMonth[key][s] = 0; });
      }
      const status = inv.status && STATUSES.includes(inv.status) ? inv.status : 'draft';
      byMonth[key][status] += inv.total_amount || 0;
      byMonth[key].count += 1;
    });

    let data = Object.values(byMonth);
    data.sort((a, b) => {
      const diff = a.year - b.year;
      if (diff !== 0) return sortOrder === 'chronological' ? diff : -diff;
      const monthDiff = a.monthIndex - b.monthIndex;
      return sortOrder === 'chronological' ? monthDiff : -monthDiff;
    });

    const totalRevenue = filtered.reduce((s, inv) => s + (inv.total_amount || 0), 0);
    return { chartData: data, totalRevenue, invoiceCount: filtered.length };
  }, [invoices, sortOrder, fromMonth, fromYear, toMonth, toYear]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#e8f4f0' }}>
              <DollarSign className="w-5 h-5" style={{ color: BRAND.green }} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: BRAND.blue }}>
            ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#e8f0f8' }}>
              <FileCheck className="w-5 h-5" style={{ color: BRAND.blue }} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Invoices</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: BRAND.blue }}>{invoiceCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fdf0ea' }}>
              <TrendingUp className="w-5 h-5" style={{ color: BRAND.orange }} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Avg / Invoice</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: BRAND.blue }}>
            ${invoiceCount > 0 ? (totalRevenue / invoiceCount).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
          </p>
        </div>
      </div>

      {/* Chart Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: BRAND.blue }}>Monthly Revenue</h2>
              <p className="text-sm text-gray-400 mt-0.5">Grouped by invoice issue date, colored by status</p>
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[190px] text-sm rounded-xl border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chronological">Chronological (Jan→Dec)</SelectItem>
                <SelectItem value="reverse">Reverse (Dec→Jan)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Picker */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
              <CalendarRange className="w-4 h-4" style={{ color: BRAND.green }} />
              <span>Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">From</span>
              <Select value={String(fromMonth)} onValueChange={v => setFromMonth(Number(v))}>
                <SelectTrigger className="w-[120px] text-sm rounded-lg border-gray-200 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES_FULL.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(fromYear)} onValueChange={v => setFromYear(Number(v))}>
                <SelectTrigger className="w-[90px] text-sm rounded-lg border-gray-200 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">To</span>
              <Select value={String(toMonth)} onValueChange={v => setToMonth(Number(v))}>
                <SelectTrigger className="w-[120px] text-sm rounded-lg border-gray-200 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES_FULL.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(toYear)} onValueChange={v => setToYear(Number(v))}>
                <SelectTrigger className="w-[90px] text-sm rounded-lg border-gray-200 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {[
                { label: 'Last 3M', months: 3 },
                { label: 'Last 6M', months: 6 },
                { label: 'Last 12M', months: 12 },
                { label: 'This Year', preset: 'year' },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => {
                    const now = new Date();
                    if (p.preset === 'year') {
                      setFromMonth(0); setFromYear(now.getFullYear());
                    } else {
                      const d = new Date(now.getFullYear(), now.getMonth() - (p.months - 1), 1);
                      setFromMonth(d.getMonth()); setFromYear(d.getFullYear());
                    }
                    setToMonth(now.getMonth()); setToYear(now.getFullYear());
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:border-[#264d44] hover:text-[#264d44] transition-colors"
                  style={{ color: BRAND.grey }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">Loading chart data...</div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-gray-400 gap-2">
            <TrendingUp className="w-10 h-10 opacity-30" />
            <p className="text-sm">No invoice data found for the selected range.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 12, bottom: 4 }} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: BRAND.grey }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: BRAND.grey }}
                axisLine={false} tickLine={false} width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(38,77,68,0.06)', radius: 8 }} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-gray-600">{STATUS_CONFIG[value]?.label || value}</span>
                )}
              />
              {STATUSES.map((status, i) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="a"
                  fill={STATUS_CONFIG[status].color}
                  radius={i === STATUSES.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}