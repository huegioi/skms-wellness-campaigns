import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, User, Calendar, Clock, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Pencil } from 'lucide-react';
import { format, isPast, isToday, formatDistanceToNow } from 'date-fns';

const priorityConfig = {
  low:    { label: 'Low',    classes: 'bg-green-100 text-green-700 border-green-200',  emoji: '🟢' },
  medium: { label: 'Medium', classes: 'bg-yellow-100 text-yellow-700 border-yellow-200', emoji: '🟡' },
  high:   { label: 'High',   classes: 'bg-red-100 text-red-700 border-red-200',        emoji: '🔴' },
  urgent: { label: 'Urgent', classes: 'bg-purple-100 text-purple-700 border-purple-200', emoji: '🚨' }
};

const statusConfig = {
  pending:           { label: 'Pending',           classes: 'bg-gray-100 text-gray-600' },
  in_progress:       { label: 'In Progress',       classes: 'bg-blue-100 text-blue-700' },
  waiting_on_them:   { label: 'Waiting on Them',   classes: 'bg-orange-100 text-orange-700' },
  snoozed:           { label: 'Snoozed',           classes: 'bg-slate-100 text-slate-500' },
  completed:         { label: 'Completed',         classes: 'bg-[#264d44]/10 text-[#264d44]' }
};

export default function FollowUpCard({ task, onEdit, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);

  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const status = statusConfig[task.status] || statusConfig.pending;
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  const handleComplete = async () => {
    setCompleting(true);
    await base44.entities.FollowUpTask.update(task.id, {
      status: 'completed',
      completed_date: new Date().toISOString()
    });
    setCompleting(false);
    onRefresh();
  };

  const SourceIcon = task.source === 'gmail' ? Mail : task.source === 'google_chat' ? MessageSquare : User;

  return (
    <div className={`bg-white rounded-xl border transition-shadow hover:shadow-md ${isOverdue ? 'border-red-200' : 'border-gray-200'} ${task.status === 'completed' ? 'opacity-60' : ''}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Source Icon */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${task.source === 'gmail' ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <SourceIcon className={`w-4 h-4 ${task.source === 'gmail' ? 'text-blue-500' : 'text-gray-500'}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`font-semibold text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {task.title}
                </span>
              </div>
              {task.contact_name && (
                <p className="text-xs text-gray-500">{task.contact_name}{task.contact_email ? ` · ${task.contact_email}` : ''}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className={`text-xs border ${priority.classes}`}>{priority.emoji} {priority.label}</Badge>
                <Badge className={`text-xs ${status.classes}`}>{status.label}</Badge>
                {isOverdue && <Badge className="text-xs bg-red-100 text-red-600">Overdue</Badge>}
                {isDueToday && !isOverdue && <Badge className="text-xs bg-amber-100 text-amber-700">Due Today</Badge>}
                {task.due_date && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(task.due_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {task.source_link && (
              <a href={task.source_link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button onClick={() => onEdit(task)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#264d44]">
              <Pencil className="w-4 h-4" />
            </button>
            {task.status !== 'completed' && (
              <button onClick={handleComplete} disabled={completing} className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600">
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {task.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
          )}
          {task.source_snippet && (
            <div className="bg-blue-50 border-l-4 border-blue-300 p-3 rounded-r-lg">
              <p className="text-xs text-blue-500 font-medium mb-0.5">Original Message</p>
              <p className="text-sm text-blue-700 italic">"{task.source_snippet}"</p>
            </div>
          )}
          {task.reminder_date && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              Reminder: {format(new Date(task.reminder_date), 'MMM d, yyyy h:mm a')}
              {task.reminder_sent && <Badge className="text-xs bg-green-50 text-green-600">Sent ✓</Badge>}
            </div>
          )}
          {(task.progress_notes || []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Progress Log</p>
              <div className="space-y-1.5">
                {[...(task.progress_notes || [])].reverse().map((n, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-sm text-gray-700">{n.note}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(n.date), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}