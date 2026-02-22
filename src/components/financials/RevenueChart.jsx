import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
      <p className="text-sm font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-lg font-bold" style={{ color: BRAND.green }}>
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
      <p className="text-xs text-gray-400">{payload[0].payload.count} invoice{payload[0].payload.count !== 1 ? 's' : ''}</p>
    </div>
  );
}

export default function RevenueChart() {
  const [sortOrder, setSortOrder] = useState('chronological');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hoveredBar, setHoveredBar] = useState(null);

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
    const toDate = new Date(toYear, toMonth + 1, 0); // last day of toMonth

    const filtered = invoices.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      const dateStr = inv.issue_date || inv.paid_date;
      if (!dateStr) return false;
      // Parse YYYY-MM-DD safely without timezone issues
      const parts = dateStr.split('T')[0].split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d >= fromDate && d <= toDate;
    });

    const byMonth = {};
    filtered.forEach(inv => {
      const dateStr = inv.issue_date || inv.paid_date;
      const date = new Date(dateStr);
      const month = MONTH_ORDER[date.getMonth()];
      const year = date.getFullYear();
      const key = `${month} ${year}`;
      if (!byMonth[key]) byMonth[key] = { month: key, monthIndex: date.getMonth(), year, amount: 0, count: 0 };
      byMonth[key].amount += inv.total_amount || 0;
      byMonth[key].count += 1;
    });

    let data = Object.values(byMonth);

    data.sort((a, b) => {
      const diff = a.year - b.year;
      if (diff !== 0) return sortOrder === 'chronological' ? diff : -diff;
      const monthDiff = a.monthIndex - b.monthIndex;
      return sortOrder === 'chronological' ? monthDiff : -monthDiff;
    });

    const totalRevenue = data.reduce((s, d) => s + d.amount, 0);
    const invoiceCount = filtered.length;

    return { chartData: data, totalRevenue, invoiceCount };
  }, [invoices, sortOrder, statusFilter, fromMonth, fromYear, toMonth, toYear]);

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
        {/* Chart Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: BRAND.blue }}>Monthly Revenue</h2>
              <p className="text-sm text-gray-400 mt-0.5">Grouped by invoice {statusFilter === 'paid' ? 'paid date' : 'date'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] text-sm rounded-xl border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              {/* Sort order */}
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
          </div>

          {/* Date Range Picker */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
              <CalendarRange className="w-4 h-4" style={{ color: BRAND.green }} />
              <span>Date Range:</span>
            </div>

            {/* From */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">From</span>
              <Select value={String(fromMonth)} onValueChange={v => setFromMonth(Number(v))}>
                <SelectTrigger className="w-[120px] text-sm rounded-lg border-gray-200 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES_FULL.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(fromYear)} onValueChange={v => setFromYear(Number(v))}>
                <SelectTrigger className="w-[90px] text-sm rounded-lg border-gray-200 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <span className="text-gray-300">→</span>

            {/* To */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">To</span>
              <Select value={String(toMonth)} onValueChange={v => setToMonth(Number(v))}>
                <SelectTrigger className="w-[120px] text-sm rounded-lg border-gray-200 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES_FULL.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(toYear)} onValueChange={v => setToYear(Number(v))}>
                <SelectTrigger className="w-[90px] text-sm rounded-lg border-gray-200 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Quick presets */}
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
            <p className="text-sm">No invoice data found for the selected filter.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 12, bottom: 4 }}
              barCategoryGap="35%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: BRAND.grey }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: BRAND.grey }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(38,77,68,0.06)', radius: 8 }} />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}
                onMouseEnter={(_, idx) => setHoveredBar(idx)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={hoveredBar === idx ? BRAND.orange : BRAND.green}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}