import React, { useState, useMemo } from 'react';
import { Download, UserCheck, AlertCircle, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TZ = 'America/New_York';

function formatET(iso, options) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...options }).format(new Date(iso));
}

function csvEscape(str) {
  const s = String(str ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ClientEngagementTab({ client, events = [], checkins = [] }) {
  const [eventFilter, setEventFilter] = useState('all');

  const { groupedByEvent, unmatched } = useMemo(() => {
    const eventMap = new Map(events.map(e => [e.id, e]));
    const byEvent = new Map();
    const unmatched = [];

    for (const c of checkins) {
      const event = eventMap.get(c.event_id);
      if (!event) {
        unmatched.push(c);
        continue;
      }
      if (!byEvent.has(c.event_id)) {
        byEvent.set(c.event_id, { event, attendees: new Map() });
      }
      const group = byEvent.get(c.event_id);
      const email = (c.email || '').toLowerCase().trim();
      if (!group.attendees.has(email)) {
        group.attendees.set(email, {
          name: c.name || '',
          email,
          count: 0,
          firstAt: c.checked_in_at,
          lastAt: c.checked_in_at,
        });
      }
      const att = group.attendees.get(email);
      att.count++;
      if (c.name) att.name = c.name;
      if (new Date(c.checked_in_at) < new Date(att.firstAt)) att.firstAt = c.checked_in_at;
      if (new Date(c.checked_in_at) > new Date(att.lastAt)) att.lastAt = c.checked_in_at;
    }

    // Sort events by start_date descending
    const grouped = [...byEvent.values()].sort((a, b) => {
      const da = a.event.start_date ? new Date(a.event.start_date) : new Date(0);
      const db = b.event.start_date ? new Date(b.event.start_date) : new Date(0);
      return db - da;
    });

    return { groupedByEvent: grouped, unmatched };
  }, [events, checkins]);

  const filteredGroups = eventFilter === 'all'
    ? groupedByEvent
    : groupedByEvent.filter(g => g.event.id === eventFilter);

  const handleDownloadCSV = () => {
    const eventMap = new Map(events.map(e => [e.id, e]));
    const rows = [['Name', 'Email', 'Event', 'Submission Date', 'Submission Time']];

    const source = eventFilter === 'all'
      ? checkins
      : checkins.filter(c => c.event_id === eventFilter);

    // Chronological log — every raw check-in including repeats
    const sorted = [...source].sort(
      (a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at)
    );

    for (const c of sorted) {
      const event = eventMap.get(c.event_id);
      const dt = new Date(c.checked_in_at);
      rows.push([
        csvEscape(c.name || ''),
        csvEscape(c.email || ''),
        csvEscape(event?.title || 'Unknown event'),
        formatET(dt, { year: 'numeric', month: '2-digit', day: '2-digit' }),
        formatET(dt, { hour: 'numeric', minute: '2-digit', hour12: true }),
      ]);
    }

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (client.company || client.name || 'client').replace(/\s+/g, '-').toLowerCase();
    a.download = `engagement-${safeName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCheckins = checkins.length;
  const uniqueAttendees = new Set(
    checkins.map(c => (c.email || '').toLowerCase().trim()).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-forest" />
            Engagement
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalCheckins} check-in{totalCheckins !== 1 ? 's' : ''} from {uniqueAttendees} unique attendee{uniqueAttendees !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
          >
            <option value="all">All events</option>
            {groupedByEvent.map(g => (
              <option key={g.event.id} value={g.event.id}>
                {g.event.title}
              </option>
            ))}
          </select>
          <Button
            onClick={handleDownloadCSV}
            disabled={totalCheckins === 0}
            className="bg-brand-forest hover:bg-[#1a2d25] text-white gap-2"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </Button>
        </div>
      </div>

      {totalCheckins === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400">No check-ins yet. Attendees will appear here after they check in to a session.</p>
        </div>
      )}

      {/* Grouped by event */}
      {filteredGroups.map(({ event, attendees }) => {
        const attendeeList = [...attendees.values()].sort(
          (a, b) => new Date(b.firstAt) - new Date(a.firstAt)
        );
        return (
          <div key={event.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 bg-gray-50/50">
              <div className="flex-shrink-0 rounded-lg text-center px-2.5 py-1.5 min-w-[48px] bg-brand-forest">
                {event.start_date ? (
                  <>
                    <p className="text-[10px] font-bold uppercase text-green-200">
                      {formatET(event.start_date, { month: 'short' })}
                    </p>
                    <p className="text-lg font-bold leading-none text-white">
                      {formatET(event.start_date, { day: 'numeric' })}
                    </p>
                  </>
                ) : (
                  <Calendar className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{event.title}</p>
                <p className="text-xs text-gray-400">
                  {attendeeList.length} attendee{attendeeList.length !== 1 ? 's' : ''}
                  {event.start_date && ` • ${formatET(event.start_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`}
                </p>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {attendeeList.map(att => (
                <div key={att.email} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-forest/10 flex items-center justify-center text-brand-forest font-semibold text-sm">
                    {(att.name || att.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{att.name || '(no name)'}</p>
                    <p className="text-xs text-gray-400 truncate">{att.email}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-500">
                      {formatET(att.firstAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                    {att.count > 1 && (
                      <span className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                        Checked in {att.count} times
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Unmatched check-ins */}
      {unmatched.length > 0 && (
        <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Unmatched check-ins</h3>
            <span className="text-xs text-amber-600">({unmatched.length})</span>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            These check-ins couldn't be linked to an event in your portal. The event may have been removed.
          </p>
          <div className="space-y-2">
            {unmatched.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-amber-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.name || '(no name)'}</p>
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                </div>
                <p className="text-xs text-gray-400">
                  {formatET(c.checked_in_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}