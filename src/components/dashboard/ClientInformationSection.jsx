import React, { useState } from 'react';
import FollowUpQueue from '@/components/dashboard/FollowUpQueue';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ListTodo, AlertCircle, Users, FileText, Send, CheckCircle2, Eye, UserPlus, UserCheck, Calendar, ClipboardCheck, Clock } from 'lucide-react';
import { format, isPast, addDays } from 'date-fns';
import ClientTaskCard from '@/components/tasks/ClientTaskCard';
import TaskList from '@/components/tasks/TaskList';

export default function ClientInformationSection() {
  const [selectedClient, setSelectedClient] = useState(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list()
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['clientTasks'],
    queryFn: () => base44.entities.ClientTask.list()
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 50)
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list('-updated_date', 50)
  });

  const clientsWithPendingTasks = clients.filter(client => {
    const clientTasks = allTasks.filter(t => t.client_id === client.id && t.status === 'pending');
    return clientTasks.length > 0;
  }).slice(0, 6);

  const generateActivityFeed = () => {
    const activities = [];

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

    // New Lead Added
    leads.slice(-10).forEach(lead => {
      activities.push({
        type: 'lead_added',
        icon: UserPlus,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        title: 'New Lead Added',
        description: `${lead.name}${lead.company ? ' · ' + lead.company : ''}`,
        date: new Date(lead.created_date)
      });
    });

    // Lead Converted to Client
    leads.filter(l => l.converted_client_id || l.status === 'current_client').forEach(lead => {
      activities.push({
        type: 'lead_converted',
        icon: UserCheck,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        title: 'Lead Converted to Client',
        description: `${lead.name}${lead.company ? ' · ' + lead.company : ''}`,
        date: new Date(lead.updated_date)
      });
    });

    // Proposal Viewed
    proposals.filter(p => p.status === 'viewed' && p.viewed_date).forEach(proposal => {
      activities.push({
        type: 'proposal_viewed',
        icon: Eye,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        title: 'Proposal Viewed',
        description: `${proposal.client_name} - $${proposal.total_amount?.toLocaleString()}`,
        date: new Date(proposal.viewed_date)
      });
    });

    // Upcoming Events (next 7 days)
    const now = new Date();
    const in7Days = addDays(now, 7);
    calendarEvents.filter(e => {
      const start = new Date(e.start_date);
      return start >= now && start <= in7Days && !e.completed;
    }).forEach(event => {
      activities.push({
        type: 'upcoming_event',
        icon: Calendar,
        color: 'text-sky-600',
        bgColor: 'bg-sky-50',
        title: 'Upcoming Event',
        description: `${event.title}${event.client_name ? ' · ' + event.client_name : ''}`,
        date: new Date(event.start_date)
      });
    });

    // Events Completed
    calendarEvents.filter(e => e.completed && e.completed_date).forEach(event => {
      activities.push({
        type: 'event_completed',
        icon: ClipboardCheck,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        title: 'Event Completed',
        description: `${event.title}${event.client_name ? ' · ' + event.client_name : ''}`,
        date: new Date(event.completed_date)
      });
    });

    // Tasks Completed
    allTasks.filter(t => t.status === 'completed' && t.completed_date).slice(-15).forEach(task => {
      const client = clients.find(c => c.id === task.client_id);
      activities.push({
        type: 'task_completed',
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        title: 'Task Completed',
        description: `${task.description}${client ? ' · ' + client.name : ''}`,
        date: new Date(task.completed_date)
      });
    });

    // Follow-up Overdue
    clients.filter(c => c.next_followup_date && isPast(new Date(c.next_followup_date))).forEach(client => {
      activities.push({
        type: 'followup_overdue',
        icon: Clock,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        title: 'Follow-up Overdue',
        description: `${client.name} — due ${format(new Date(client.next_followup_date), 'MMM d')}`,
        date: new Date(client.next_followup_date)
      });
    });

    return activities.sort((a, b) => b.date - a.date).slice(0, 20);
  };

  const activityFeed = generateActivityFeed();

  return (
    <div className="space-y-8">
      {/* Open Clients Section */}
      {clientsWithPendingTasks.length > 0 && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ListTodo className="w-6 h-6 text-blue-600" />
              Open Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientsWithPendingTasks.map(client => {
                const clientTasks = allTasks.filter(t => t.client_id === client.id);
                return (
                  <ClientTaskCard 
                    key={client.id} 
                    client={client}
                    tasks={clientTasks}
                    onClick={() => setSelectedClient(client)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Follow-Up Queue */}
      <FollowUpQueue />

      {/* Task Management Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedClient?.name} - Task Management
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="mt-4 overflow-y-auto max-h-[calc(85vh-8rem)] pr-2">
              <TaskList clientId={selectedClient.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent Activity */}
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
  );
}