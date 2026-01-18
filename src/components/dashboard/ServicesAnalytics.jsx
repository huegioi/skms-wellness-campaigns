import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, TrendingUp, Package } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ServicesAnalytics() {
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const calculateInvoiceAnalytics = () => {
    const servicePurchases = {};
    const serviceRevenue = {};
    const serviceHierarchy = {};
    let totalRevenue = 0;
    let totalItems = 0;

    // Process all invoice line items
    invoices.forEach(invoice => {
      if (invoice.line_items && Array.isArray(invoice.line_items)) {
        invoice.line_items.forEach(item => {
          const serviceName = item.description || 'Other';
          const quantity = item.quantity || 1;
          const amount = item.amount || 0;

          // Count purchases
          servicePurchases[serviceName] = (servicePurchases[serviceName] || 0) + quantity;
          
          // Sum revenue
          serviceRevenue[serviceName] = (serviceRevenue[serviceName] || 0) + amount;
          
          // Build hierarchy (track individual line items)
          if (!serviceHierarchy[serviceName]) {
            serviceHierarchy[serviceName] = {
              name: serviceName,
              totalPurchases: 0,
              totalRevenue: 0,
              items: []
            };
          }
          
          serviceHierarchy[serviceName].totalPurchases += quantity;
          serviceHierarchy[serviceName].totalRevenue += amount;
          serviceHierarchy[serviceName].items.push({
            invoiceId: invoice.invoice_number || invoice.id,
            clientName: invoice.client_name,
            quantity,
            amount,
            date: invoice.issue_date
          });

          totalRevenue += amount;
          totalItems += quantity;
        });
      }
    });

    // Top services by purchase count
    const topServicesByCount = Object.entries(servicePurchases)
      .map(([name, count]) => ({
        name,
        count,
        revenue: serviceRevenue[name],
        avgValue: serviceRevenue[name] / count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top services by revenue
    const topServicesByRevenue = Object.entries(serviceRevenue)
      .map(([name, revenue]) => ({
        name,
        revenue,
        count: servicePurchases[name],
        avgValue: revenue / servicePurchases[name]
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Monthly service demand
    const monthlyDemand = {};
    invoices.forEach(invoice => {
      if (invoice.issue_date && invoice.line_items) {
        const month = new Date(invoice.issue_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthlyDemand[month]) monthlyDemand[month] = { month, revenue: 0, items: 0 };
        
        invoice.line_items.forEach(item => {
          monthlyDemand[month].revenue += item.amount || 0;
          monthlyDemand[month].items += item.quantity || 1;
        });
      }
    });
    const monthlyTrend = Object.values(monthlyDemand).slice(-12);

    // Service hierarchy for display
    const hierarchyData = Object.values(serviceHierarchy)
      .sort((a, b) => b.totalPurchases - a.totalPurchases);

    return {
      topServicesByCount,
      topServicesByRevenue,
      monthlyTrend,
      hierarchyData,
      totalRevenue,
      totalItems,
      uniqueServices: Object.keys(servicePurchases).length
    };
  };

  const analytics = calculateInvoiceAnalytics();

  return (
    <div className="space-y-8">
      {/* QuickBooks Service Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold">${qbAnalytics.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Transactions</p>
                <p className="text-2xl font-bold">{qbAnalytics.totalTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Service Types</p>
                <p className="text-2xl font-bold">{qbAnalytics.serviceCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg. Transaction</p>
                <p className="text-2xl font-bold">${qbAnalytics.totalTransactions > 0 ? (qbAnalytics.totalRevenue / qbAnalytics.totalTransactions).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proposal KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Proposals</p>
                <p className="text-2xl font-bold">{analytics.totalProposals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Acceptance Rate</p>
                <p className="text-2xl font-bold">{analytics.acceptanceRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg. Value</p>
                <p className="text-2xl font-bold">${analytics.avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg. View Time</p>
                <p className="text-2xl font-bold">{analytics.avgViewTime}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#264d44] to-[#1a3830] rounded-xl p-5 text-white">
          <p className="text-sm opacity-80">Total Pipeline</p>
          <p className="text-2xl font-bold">${analytics.totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-[#770142] to-[#441d37] rounded-xl p-5 text-white">
          <p className="text-sm opacity-80">Won Revenue</p>
          <p className="text-2xl font-bold">${analytics.acceptedValue.toLocaleString()}</p>
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sent</p>
                <p className="text-2xl font-bold">{analytics.sentProposals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">View Rate</p>
                <p className="text-2xl font-bold">{analytics.viewRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Top Services by Revenue (QuickBooks) */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Top Services by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {qbAnalytics.topServicesByRevenue.length > 0 ? (
              <div className="space-y-3">
                {qbAnalytics.topServicesByRevenue.map((service, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{service.name}</p>
                        <span className="text-sm font-bold text-green-600 ml-2">${service.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-600" 
                            style={{ width: `${(service.revenue / qbAnalytics.topServicesByRevenue[0].revenue) * 100}%` }} 
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{service.count} transactions • Avg: ${service.avgRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">No revenue data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Proposal Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie 
                    data={analytics.statusData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={100} 
                    dataKey="value" 
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Top Services (Proposals) */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Most Popular Services</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {analytics.topServices.length > 0 ? (
              <div className="space-y-3">
                {analytics.topServices.map((service, i) => (
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
                        <div 
                          className="h-2 rounded-full" 
                          style={{ 
                            width: `${(service.count / analytics.topServices[0].count) * 100}%`, 
                            background: '#264d44' 
                          }} 
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{service.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Trends */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Monthly Revenue (QuickBooks)</CardTitle>
        </CardHeader>
        <CardContent>
          {qbAnalytics.monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={qbAnalytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Revenue" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">No revenue data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Proposal Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.trendData}>
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
        </CardContent>
      </Card>
    </div>
  );
}