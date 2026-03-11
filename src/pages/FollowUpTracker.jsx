import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Clock, AlertCircle, CheckCircle2, RefreshCw, Mail, MessageSquare, Filter } from 'lucide-react';
import FollowUpCard from '@/components/followup/FollowUpCard';
import FollowUpDialog from '@/components/followup/FollowUpDialog';
import { isToday, isPast, isFuture } from 'date-fns';

export default function FollowUpTracker() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['followUpTasks'],
    queryFn: () => base44.entities.FollowUpTask.list('-created_date', 200),
    staleTime: 30 * 1000
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['followUpTasks'] });

  const openCreate = () => { setEditingTask(null); setDialogOpen(true); };
  const openEdit = (task) => { setEditingTask(task); setDialogOpen(true); };

  // Derived stats
  const activeCount = tasks.filter(t => t.status !== 'completed').length;
  const overdueCount = tasks.filter(t => t.status !== 'completed' && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length;
  const dueTodayCount = tasks.filter(t => t.status !== 'completed' && t.due_date && isToday(new Date(t.due_date))).length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  // Filter
  const filtered = tasks.filter(task => {
    if (filterStatus === 'active' && task.status === 'completed') return false;
    if (filterStatus === 'completed' && task.status !== 'completed') return false;
    if (filterStatus === 'overdue' && !(task.status !== 'completed' && task.due_date && isPast(new Date(task.due_date)))) return false;
    if (filterStatus === 'due_today' && !(task.status !== 'completed' && task.due_date && isToday(new Date(task.due_date)))) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterSource !== 'all' && task.source !== filterSource) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!task.title?.toLowerCase().includes(q) &&
          !task.contact_name?.toLowerCase().includes(q) &&
          !task.contact_email?.toLowerCase().includes(q) &&
          !task.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Sort: urgent/high first, then by due date
  const sorted = [...filtered].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#013f7c]">Follow-Up Tracker</h1>
            <p className="text-sm text-gray-500 mt-0.5">Never let a conversation fall through the cracks</p>
          </div>
          <Button onClick={openCreate} className="bg-[#264d44] hover:bg-[#1a3830] text-white gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            New Follow-Up
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active', value: activeCount, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', filter: 'active' },
            { label: 'Overdue', value: overdueCount, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', filter: 'overdue' },
            { label: 'Due Today', value: dueTodayCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', filter: 'due_today' },
            { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-[#264d44]', bg: 'bg-[#264d44]/10', filter: 'completed' }
          ].map(stat => (
            <button
              key={stat.filter}
              onClick={() => setFilterStatus(stat.filter === filterStatus ? 'active' : stat.filter)}
              className={`bg-white rounded-xl p-4 border text-left hover:shadow-md transition-shadow ${filterStatus === stat.filter ? 'border-[#264d44] ring-1 ring-[#264d44]/30' : 'border-gray-200'}`}
            >
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or title..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">🚨 Urgent</SelectItem>
                <SelectItem value="high">🔴 High</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="gmail">📧 Gmail</SelectItem>
                <SelectItem value="google_chat">💬 Google Chat</SelectItem>
                <SelectItem value="manual">✏️ Manual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refresh} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading follow-ups...
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No follow-ups found</p>
            <p className="text-sm text-gray-300 mt-1">
              {filterStatus === 'active' ? "You're all caught up!" : "Nothing in this category yet."}
            </p>
            {filterStatus === 'active' && (
              <Button onClick={openCreate} className="mt-4 bg-[#264d44] hover:bg-[#1a3830] text-white gap-2">
                <Plus className="w-4 h-4" /> Add your first follow-up
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{sorted.length} follow-up{sorted.length !== 1 ? 's' : ''}</p>
            {sorted.map(task => (
              <FollowUpCard key={task.id} task={task} onEdit={openEdit} onRefresh={refresh} />
            ))}
          </div>
        )}
      </div>

      <FollowUpDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        task={editingTask}
        onSave={refresh}
      />
    </div>
  );
}