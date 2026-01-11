import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, AlertCircle, Clock, Users, FileText, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState('month');

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: proposals = [], isLoading: loadingProposals } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list()
  });

  const isLoading = loadingInvoices || loadingClients || loadingProposals;

  // Calculate metrics
  const calculateMetrics = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startDate = timeframe === 'month' ? startOfMonth : startOfQuarter;

    const periodInvoices = invoices.filter(inv => 
      new Date(inv.created_date) >= startDate
    );

    const totalInvoiced = periodInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const outstanding = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    
    const dueSoon = invoices.filter(inv => {
      if (inv.status !== 'sent') return false;
      const dueDate = new Date(inv.due_date);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue >= 0;
    }).length;

    return { totalInvoiced, totalPaid, outstanding, dueSoon };
  };

  const metrics = calculateMetrics();

  // Generate activity feed
  const generateActivityFeed = () => {
    const activities = [];

    // Recent clients
    clients.slice(-10).forEach(client => {
      activities.push({
        type: 'client',
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        title: 'New Client Added',
        description: client.name,
        date: new Date(client.created_date)
      });
    });

    // Recent invoices
    invoices.slice(-10).forEach(invoice => {
      if (invoice.status === 'sent') {
        activities.push({
          type: 'invoice_sent',
          icon: Send,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          title: 'Invoice Sent',
          description: `${invoice.client_name} - $${invoice.total_amount?.toLocaleString()}`,
          date: new Date(invoice.created_date)
        });
      } else if (invoice.status === 'paid') {
        activities.push({
          type: 'invoice_paid',
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          title: 'Invoice Paid',
          description: `${invoice.client_name} - $${invoice.total_amount?.toLocaleString()}`,
          date: invoice.paid_date ? new Date(invoice.paid_date) : new Date(invoice.created_date)
        });
      }
    });

    // Recent proposals
    proposals.slice(-10).forEach(proposal => {
      if (proposal.status === 'sent') {
        activities.push({
          type: 'proposal_sent',
          icon: FileText,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          title: 'Proposal Sent',
          description: `${proposal.client_name} - $${proposal.total_amount?.toLocaleString()}`,
          date: proposal.sent_date ? new Date(proposal.sent_date) : new Date(proposal.created_date)
        });
      } else if (proposal.status === 'accepted') {
        activities.push({
          type: 'proposal_accepted',
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          title: 'Proposal Accepted',
          description: `${proposal.client_name} - $${proposal.total_amount?.toLocaleString()}`,
          date: new Date(proposal.created_date)
        });
      }
    });

    return activities.sort((a, b) => b.date - a.date).slice(0, 15);
  };

  const activityFeed = generateActivityFeed();

  const StatCard = ({ title, value, icon: Icon, trend, color = "text-gray-600" }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {trend && (
              <p className="text-sm text-gray-500 mt-1">{trend}</p>
            )}
          </div>
          <div className={`p-4 rounded-full ${color.replace('text', 'bg').replace('600', '100')}`}>
            <Icon className={`w-8 h-8 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Dashboard
          </h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your business.</p>
        </div>

        {/* Timeframe Selector */}
        <div className="mb-6">
          <Tabs value={timeframe} onValueChange={setTimeframe}>
            <TabsList>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="quarter">This Quarter</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title={`Total Invoiced (${timeframe === 'month' ? 'This Month' : 'This Quarter'})`}
            value={`$${metrics.totalInvoiced.toLocaleString()}`}
            icon={DollarSign}
            color="text-blue-600"
          />
          <StatCard
            title="Total Paid"
            value={`$${metrics.totalPaid.toLocaleString()}`}
            icon={CheckCircle2}
            color="text-green-600"
          />
          <StatCard
            title="Outstanding"
            value={`$${metrics.outstanding.toLocaleString()}`}
            icon={TrendingUp}
            color="text-orange-600"
          />
          <StatCard
            title="Due Soon (7 days)"
            value={metrics.dueSoon}
            icon={Clock}
            color="text-red-600"
          />
        </div>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {activityFeed.map((activity, idx) => {
                  const Icon = activity.icon;
                  return (
                    <div key={idx} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className={`p-2 rounded-lg ${activity.bgColor}`}>
                        <Icon className={`w-5 h-5 ${activity.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800">{activity.title}</p>
                        <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(activity.date, 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}