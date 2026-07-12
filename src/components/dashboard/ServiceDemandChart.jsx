import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { eventCategory, isDeliveryEvent, CATEGORY_CHIP_LABELS } from '@/lib/serviceMatching';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CATEGORY_CHIPS = ['all', 'workshop', 'challenge', 'class', 'leadership', 'wellness_box'];

export default function ServiceDemandChart({ events, serviceMap }) {
  const [category, setCategory] = useState('all');

  const chartData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: `${MONTH_LABELS[d.getMonth()]}'${String(d.getFullYear()).slice(2)}`, count: 0 });
    }
    const monthMap = {};
    months.forEach(m => { monthMap[m.key] = m; });

    events.forEach(e => {
      if (e.is_demo) return;
      if (!isDeliveryEvent(e)) return;
      if (!e.start_date) return;
      const cat = eventCategory(e, serviceMap);
      if (!cat) return;
      if (category !== 'all' && cat !== category) return;
      const d = new Date(e.start_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap[key]) monthMap[key].count++;
    });

    return months;
  }, [events, serviceMap, category]);

  const hasData = chartData.some(m => m.count > 0);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Demand by Month</CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">Delivery events by start date (last 12 months).</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORY_CHIPS.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  category === cat
                    ? 'bg-[#264d44] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? 'All' : CATEGORY_CHIP_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="count" name="Events" fill="#264d44" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            No delivery events in this range
          </div>
        )}
      </CardContent>
    </Card>
  );
}