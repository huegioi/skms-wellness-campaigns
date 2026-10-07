import React, { useState, useEffect, useCallback } from 'react';
import { BellRing, Flag, CheckCircle2, Circle, Users, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { renderInline } from '@/lib/renderInline';

export default function FollowUpsSection({ currentUser, refreshKey }) {
  const [reminders, setReminders] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set());
  const [openGroups, setOpenGroups] = useState(new Set());
  const [groupLeads, setGroupLeads] = useState({});

  const loadReminders = useCallback(async () => {
    try {
      const raw = await base44.entities.MayaReminder.filter({ status: 'open' }, 'trigger_date', 200);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const sorted = raw.map(r => {
        const triggerStart = new Date(r.trigger_date);
        triggerStart.setHours(0, 0, 0, 0);
        const overdueDays = Math.round((todayStart - triggerStart) / 86400000);
        return { ...r, overdueDays, overdue: overdueDays >= 3 };
      }).sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return new Date(a.trigger_date) - new Date(b.trigger_date);
      });
      setReminders(sorted);
    } catch (e) {
      console.log('[FollowUpsSection] Failed to load reminders:', e.message);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders, refreshKey]);

  // Grouped reminders expand to show who is in the group (names loaded on demand)
  const toggleGroup = async (r) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(r.id) ? next.delete(r.id) : next.add(r.id);
      return next;
    });
    if (groupLeads[r.id] || !(r.lead_ids || []).length) return;
    try {
      const rows = await base44.entities.Lead.filter({ id: { $in: r.lead_ids } }, 'name', 200);
      setGroupLeads(prev => ({ ...prev, [r.id]: rows }));
    } catch (e) {
      console.log('[FollowUpsSection] Failed to load group:', e.message);
    }
  };

  const handleComplete = async (id) => {
    setDoneIds(prev => new Set([...prev, id]));
    const firstName = currentUser?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'User';
    try {
      await base44.entities.MayaReminder.update(id, {
        status: 'done',
        completed_by: firstName,
        completed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.log('[FollowUpsSection] Failed to complete reminder:', id, e.message);
    }
  };

  if (reminders.length === 0) return null;

  const overdueCount = reminders.filter(r => r.overdue && !doneIds.has(r.id)).length;
  const firstName = currentUser?.full_name?.split(' ')[0] || 'User';

  return (
    <div className="pt-3">
      <div className="flex items-center gap-2 mb-2">
        <BellRing className="w-3.5 h-3.5 text-amber-700" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-amber-700">Follow-Ups</h3>
        <span className="rounded-full bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 font-medium">{reminders.length}</span>
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 font-medium">{overdueCount} overdue</span>
        )}
      </div>
      <div className="space-y-0.5">
        {reminders.map(r => {
          const isDone = doneIds.has(r.id);
          const isGroup = (r.lead_ids || []).length > 0 && !r.lead_id;
          const isOpen = openGroups.has(r.id);
          const leadLink = r.lead_id ? createPageUrl('Leads') + `?leadId=${r.lead_id}` : null;
          const groupLink = isGroup && r.group_key && !r.group_key.startsWith('__')
            ? createPageUrl('Leads') + `?tag=${encodeURIComponent(r.group_key)}` : null;
          return (
            <div key={r.id}>
              <div
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors group ${
                  isDone ? 'bg-green-50' : r.overdue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  className="mt-0.5 flex-shrink-0"
                  title={isGroup ? 'Mark this batch done' : 'Mark done'}
                  onClick={() => !isDone && handleComplete(r.id)}
                >
                  {isDone
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm leading-snug ${isDone ? 'line-through text-gray-400' : 'text-gray-700'} ${isGroup ? 'cursor-pointer' : ''}`}
                    onClick={() => isGroup && toggleGroup(r)}
                  >
                    {isGroup && (isOpen
                      ? <ChevronDown className="w-3.5 h-3.5 inline-block mr-0.5 text-gray-400" style={{ verticalAlign: 'text-bottom' }} />
                      : <ChevronRight className="w-3.5 h-3.5 inline-block mr-0.5 text-gray-400" style={{ verticalAlign: 'text-bottom' }} />)}
                    {isGroup && <Users className="w-3.5 h-3.5 inline-block mr-1 text-blue-500" style={{ verticalAlign: 'text-bottom' }} />}
                    {r.overdue && !isDone && !isGroup && (
                      <Flag className="w-3.5 h-3.5 text-red-500 inline-block mr-1" style={{ verticalAlign: 'text-bottom' }} />
                    )}
                    {renderInline(r.text)}
                    {r.overdue && !isDone && (
                      <span className="ml-2 rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 font-medium">
                        {r.overdueDays}d overdue
                      </span>
                    )}
                    {isDone && (
                      <span className="ml-2 text-xs text-green-600 no-underline not-italic font-medium">
                        ✓ {firstName}
                      </span>
                    )}
                  </span>
                  {!isDone && (leadLink || groupLink) && (
                    <Link to={leadLink || groupLink} className="ml-2 text-xs text-[#013f7c] hover:underline inline-flex items-center gap-0.5">
                      {isGroup ? 'Open group' : 'Open'} <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  {isGroup && isOpen && (
                    <ul className="mt-1.5 ml-1 space-y-0.5">
                      {(groupLeads[r.id] || []).map(l => (
                        <li key={l.id} className="text-xs text-gray-600">
                          <Link to={createPageUrl('Leads') + `?leadId=${l.id}`} className="hover:underline">
                            {l.name}{l.company ? ` · ${l.company}` : ''}
                          </Link>
                          {l.owner && <span className="text-gray-400"> · {l.owner}</span>}
                        </li>
                      ))}
                      {!groupLeads[r.id] && <li className="text-xs text-gray-400">Loading…</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}