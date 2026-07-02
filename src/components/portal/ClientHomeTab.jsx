import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, Users, Package, ArrowRight, MapPin, Clock, FileText, BarChart3, FolderOpen, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadICS } from '@/lib/ics';

const SELECTION_CATEGORIES = ['workshops', 'challengePrograms', 'leadership', 'movementClasses'];

export default function ClientHomeTab({ events = [], proposals = [], stats, onNavigate }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => !e.completed && new Date(e.start_date) > now)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  }, [events]);

  const nextSession = upcoming[0] || null;
  const upcomingCount = upcoming.length;

  const activePrograms = useMemo(() => {
    const serviceIds = new Set();
    proposals
      .filter(p => p.status === 'accepted')
      .forEach(p => {
        const sel = p.selections || {};
        SELECTION_CATEGORIES.forEach(cat => {
          (sel[cat] || []).forEach(id => serviceIds.add(id));
        });
      });
    return serviceIds.size;
  }, [proposals]);

  const peopleEngaged = stats?.people_engaged ?? 0;

  return (
    <div className="space-y-8">
      {/* Next Session */}
      {nextSession ? (
        <NextSessionCard event={nextSession} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border-l-4 border-l-brand-forest p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: '#223d3214' }}>
              <Calendar className="w-6 h-6 text-brand-forest" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">No upcoming sessions</p>
              <p className="text-sm text-gray-500">Book your next one to keep the momentum going.</p>
            </div>
          </div>
          <Button onClick={() => onNavigate('book')} className="bg-brand-forest hover:bg-[#1a2d25] text-white gap-2">
            Book a Session <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile icon={Users} label="People Engaged" value={peopleEngaged} color="#013f7c" caption="Distinct participants across programs" />
        <StatTile icon={Calendar} label="Upcoming Sessions" value={upcomingCount} color="#223d32" caption="On the calendar" />
        <StatTile icon={Package} label="Programs Active" value={activePrograms} color="#770142" caption="In accepted programming" />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink icon={FileText} label="View your programming" description="Workshops, challenges & programs" onClick={() => onNavigate('proposal')} color="#264d44" />
        <QuickLink icon={BarChart3} label="See your wellness ROI" description="Impact metrics & feedback" onClick={() => onNavigate('feedback')} color="#013f7c" />
        <QuickLink icon={FolderOpen} label="Browse resources" description="Recordings, handouts & guides" onClick={() => onNavigate('resources')} color="#770142" />
      </div>
    </div>
  );
}

function NextSessionCard({ event }) {
  const start = parseISO(event.start_date);
  const isLink = event.location && /^https?:\/\//i.test(event.location);
  return (
    <div className="bg-white rounded-2xl shadow-sm border-l-4 border-l-brand-forest p-5 flex items-center gap-4">
      <div className="flex-shrink-0 rounded-xl text-center px-3 py-2 min-w-[56px] bg-brand-forest">
        <p className="text-xs font-bold uppercase text-green-200">{format(start, 'MMM')}</p>
        <p className="text-2xl font-bold leading-none text-white">{format(start, 'd')}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-forest mb-0.5">Next Session</p>
        <p className="font-semibold text-gray-800 truncate">{event.title}</p>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{format(start, 'h:mm a')}</span>
          {event.presenter && (
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{event.presenter}</span>
          )}
          {event.location && (
            isLink ? (
              <a href={event.location} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-navy hover:underline">
                <MapPin className="w-3.5 h-3.5" />Join link
              </a>
            ) : (
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.location}</span>
            )
          )}
        </div>
      </div>
      <button
        onClick={() => downloadICS({
          id: event.id,
          title: event.title,
          start: event.start_date,
          end: event.end_date,
          location: event.location,
          description: event.description,
        })}
        className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-brand-forest hover:bg-gray-100 transition-colors"
        title="Add to calendar"
      >
        <CalendarPlus className="w-5 h-5" />
      </button>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color, caption }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="inline-flex p-2 rounded-lg mb-3" style={{ backgroundColor: color + '14' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-1">{label}</p>
      {caption && <p className="text-xs text-gray-400 mt-0.5">{caption}</p>}
    </div>
  );
}

function QuickLink({ icon: Icon, label, description, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-2xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="inline-flex p-2 rounded-lg mb-3" style={{ backgroundColor: color + '14' }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </button>
  );
}