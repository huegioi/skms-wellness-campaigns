import React, { useState, useEffect, useCallback } from 'react';
import { BellRing, Flag, CheckCircle2, Circle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { renderInline } from '@/lib/renderInline';

export default function FollowUpsSection({ currentUser, refreshKey }) {
  const [reminders, setReminders] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set());

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
          return (
            <div
              key={r.id}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
                isDone ? 'bg-green-50' : r.overdue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => !isDone && handleComplete(r.id)}
            >
              <div className="mt-0.5 flex-shrink-0">
                {isDone
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                }
              </div>
              <span className={`text-sm leading-snug ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {r.overdue && !isDone && (
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
            </div>
          );
        })}
      </div>
    </div>
  );
}