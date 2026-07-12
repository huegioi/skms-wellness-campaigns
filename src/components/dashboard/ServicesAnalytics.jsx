import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, TrendingUp, Package } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ServicesAnalytics() {
  const { data: rawInvoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const invoices = rawInvoices.filter(i => !i.is_demo);

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
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold">${analytics.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Items Purchased</p>
                <p className="text-2xl font-bold">{analytics.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Unique Services</p>
                <p className="text-2xl font-bold">{analytics.uniqueServices}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg. Item Value</p>
                <p className="text-2xl font-bold">${analytics.totalItems > 0 ? (analytics.totalRevenue / analytics.totalItems).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Top Services by Purchase Count */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Most Purchased Services</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {analytics.topServicesByCount.length > 0 ? (
              <div className="space-y-3">
                {analytics.topServicesByCount.map((service, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{service.name}</p>
                        <span className="text-sm font-bold text-blue-600 ml-2">{service.count} units</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600" 
                            style={{ width: `${(service.count / analytics.topServicesByCount[0].count) * 100}%` }} 
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">${service.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} revenue • Avg: ${service.avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">No purchase data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Top Services by Revenue */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Top Services by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {analytics.topServicesByRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.topServicesByRevenue} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="#22C55E" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">No revenue data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Purchase Hierarchy */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Service Purchase Hierarchy</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {analytics.hierarchyData.length > 0 ? (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {analytics.hierarchyData.map((service, i) => (
                <div key={i} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">{service.name}</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-blue-600 font-medium">{service.totalPurchases} units</span>
                      <span className="text-green-600 font-medium">${service.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {service.items.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm text-gray-600 bg-white p-2 rounded">
                        <span className="truncate flex-1">{item.clientName}</span>
                        <div className="flex gap-3 ml-2">
                          <span>{item.quantity}x</span>
                          <span className="font-medium">${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    ))}
                    {service.items.length > 5 && (
                      <p className="text-xs text-gray-500 text-center">+ {service.items.length - 5} more purchases</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">No purchase data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Service Demand Trends */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Monthly Service Demand</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => name === 'revenue' ? `$${value.toLocaleString()}` : `${value} items`} />
                <Legend />
                <Line yAxisId="right" type="monotone" dataKey="items" name="Items Purchased" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 4 }} />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">No demand data yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}