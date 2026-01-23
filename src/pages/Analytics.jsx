import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, FileText, Clock, Eye, CheckCircle, Send, Users, Mail, UserPlus, Tag } from 'lucide-react';
import { productCatalog } from '@/components/curriculum/catalogData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Analytics() {
  const [selectedTags, setSelectedTags] = useState([]);
  
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date')
  });

  const { data: kajabiStats } = useQuery({
    queryKey: ['kajabiStats'],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncKajabi', { action: 'getStats' });
      return response.data?.stats || null;
    },
    refetchInterval: 300000
  });

  const { data: kajabiContacts = [] } = useQuery({
    queryKey: ['kajabiContacts'],
    queryFn: () => base44.entities.KajabiContact.list('-last_synced'),
    initialData: []
  });

  if (isLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  // Calculate metrics
  const totalProposals = proposals.length;
  const sentProposals = proposals.filter(p => ['sent', 'viewed', 'accepted', 'declined'].includes(p.status)).length;
  const acceptedProposals = proposals.filter(p => p.status === 'accepted').length;
  const viewedProposals = proposals.filter(p => p.viewed_date).length;
  const acceptanceRate = sentProposals > 0 ? ((acceptedProposals / sentProposals) * 100).toFixed(1) : 0;
  const viewRate = sentProposals > 0 ? ((viewedProposals / sentProposals) * 100).toFixed(1) : 0;
  const totalValue = proposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const avgValue = totalProposals > 0 ? totalValue / totalProposals : 0;
  const acceptedValue = proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + (p.total_amount || 0), 0);

  // Status distribution
  const statusData = [
    { name: 'Draft', value: proposals.filter(p => p.status === 'draft').length, color: '#9CA3AF' },
    { name: 'Sent', value: proposals.filter(p => p.status === 'sent').length, color: '#3B82F6' },
    { name: 'Viewed', value: proposals.filter(p => p.status === 'viewed').length, color: '#8B5CF6' },
    { name: 'Accepted', value: proposals.filter(p => p.status === 'accepted').length, color: '#22C55E' },
    { name: 'Declined', value: proposals.filter(p => p.status === 'declined').length, color: '#EF4444' }
  ].filter(d => d.value > 0);

  // Service popularity
  const serviceCounts = { workshops: {}, challenges: {}, leadership: {}, classes: {} };
  proposals.forEach(p => {
    const sel = p.selections || {};
    (sel.workshops || []).forEach(k => { serviceCounts.workshops[k] = (serviceCounts.workshops[k] || 0) + 1; });
    (sel.challengePrograms || []).forEach(k => { serviceCounts.challenges[k] = (serviceCounts.challenges[k] || 0) + 1; });
    (sel.leadership || []).forEach(k => { serviceCounts.leadership[k] = (serviceCounts.leadership[k] || 0) + 1; });
    (sel.movementClasses || []).forEach(k => { serviceCounts.classes[k] = (serviceCounts.classes[k] || 0) + 1; });
  });

  const topServices = [
    ...Object.entries(serviceCounts.workshops).map(([k, v]) => ({ name: productCatalog.workshops[k]?.name || k, count: v, type: 'Workshop' })),
    ...Object.entries(serviceCounts.challenges).map(([k, v]) => ({ name: productCatalog.challenges[k]?.name || k, count: v, type: 'Challenge' })),
    ...Object.entries(serviceCounts.leadership).map(([k, v]) => ({ name: productCatalog.leadership[k]?.name || k, count: v, type: 'Leadership' })),
    ...Object.entries(serviceCounts.classes).map(([k, v]) => ({ name: productCatalog.movementClasses[k]?.name || k, count: v, type: 'Class' }))
  ].sort((a, b) => b.count - a.count).slice(0, 8);

  // Monthly trends
  const monthlyData = {};
  proposals.forEach(p => {
    const month = new Date(p.created_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!monthlyData[month]) monthlyData[month] = { month, count: 0, value: 0, accepted: 0 };
    monthlyData[month].count++;
    monthlyData[month].value += p.total_amount || 0;
    if (p.status === 'accepted') monthlyData[month].accepted++;
  });
  const trendData = Object.values(monthlyData).slice(-6);

  // Response times
  const responseTimes = proposals
    .filter(p => p.sent_date && p.viewed_date)
    .map(p => {
      const sent = new Date(p.sent_date);
      const viewed = new Date(p.viewed_date);
      return (viewed - sent) / (1000 * 60 * 60); // hours
    });
  const avgViewTime = responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) : 0;

  const COLORS = ['#264d44', '#770142', '#013f7c', '#eaf995', '#cae5e3'];

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Analytics Dashboard</h1>
          <p className="text-gray-600">Insights into your proposal performance</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><FileText className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Total Proposals</p>
                <p className="text-2xl font-bold">{totalProposals}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Acceptance Rate</p>
                <p className="text-2xl font-bold">{acceptanceRate}%</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><DollarSign className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Avg. Value</p>
                <p className="text-2xl font-bold">${avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Avg. View Time</p>
                <p className="text-2xl font-bold">{avgViewTime}h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#264d44] to-[#1a3830] rounded-xl p-5 text-white">
            <p className="text-sm opacity-80">Total Pipeline</p>
            <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-[#770142] to-[#441d37] rounded-xl p-5 text-white">
            <p className="text-sm opacity-80">Won Revenue</p>
            <p className="text-2xl font-bold">${acceptedValue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Send className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Sent</p>
                <p className="text-2xl font-bold">{sentProposals}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><Eye className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-gray-500">View Rate</p>
                <p className="text-2xl font-bold">{viewRate}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Proposal Status Distribution</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">No data yet</div>
            )}
          </div>

          {/* Top Services */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Most Popular Services</h3>
            {topServices.length > 0 ? (
              <div className="space-y-3">
                {topServices.map((service, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{
                      background: service.type === 'Workshop' ? '#e0f2fe' : service.type === 'Challenge' ? '#fce7f3' : service.type === 'Leadership' ? '#f3e8ff' : '#dcfce7',
                      color: service.type === 'Workshop' ? '#0369a1' : service.type === 'Challenge' ? '#be185d' : service.type === 'Leadership' ? '#7c3aed' : '#16a34a'
                    }}>
                      {service.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{service.name}</p>
                      <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                        <div className="h-2 rounded-full" style={{ width: `${(service.count / topServices[0].count) * 100}%`, background: '#264d44' }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{service.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">No data yet</div>
            )}
          </div>
        </div>

        {/* Monthly Trends */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Monthly Trends</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => name === 'value' ? `$${value.toLocaleString()}` : value} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="count" name="Proposals" stroke="#013f7c" strokeWidth={2} dot={{ fill: '#013f7c' }} />
                <Line yAxisId="left" type="monotone" dataKey="accepted" name="Accepted" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E' }} />
                <Line yAxisId="right" type="monotone" dataKey="value" name="Total Value" stroke="#770142" strokeWidth={2} dot={{ fill: '#770142' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">No data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}