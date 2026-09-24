import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle2, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { downloadICSMulti } from '@/lib/ics';
import { format } from 'date-fns';
import AddToCalendarMenu from './AddToCalendarMenu';
import { buildTimelineItems, timelineStatus, relativeDay, TIMELINE_ACTIONS } from './timelineItems';

export default function ClientTimeline({ events = [], proposal, services = [] }) {
  const [pastExpanded, setPastExpanded] = useState(false);
  const ACTIONS = TIMELINE_ACTIONS;
  const portalUrl = typeof window !== 'undefined' ? window.location.href : '';
  const items = buildTimelineItems(events, services, portalUrl);
  const statusOf = timelineStatus;
  const relative = relativeDay;

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Events Scheduled Yet</h3>
          <p className="text-gray-500">Your event timeline will appear here once events are scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  const pastItems = items.filter(i => statusOf(i) === 'past');
  const upcomingItems = items.filter(i => statusOf(i) !== 'past');
  const upcomingCal = upcomingItems.map(i => i.cal).filter(Boolean);

  const Chip = ({ item, muted }) => {
    if (item.kind === 'event') {
      const Icon = item.config.icon;
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ backgroundColor: muted ? '#9ca3af' : item.config.color }}>
          <Icon className="w-3 h-3" /> {item.config.label}
        </span>
      );
    }
    const a = ACTIONS[item.kind];
    const Icon = a.icon;
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ color: muted ? '#6b7280' : a.color, backgroundColor: muted ? '#f3f4f6' : a.bg }}>
        <Icon className="w-3 h-3" /> {a.label}
      </span>
    );
  };

  const Thumb = ({ item, muted }) => (
    <div className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-md border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center ${muted ? 'opacity-50 grayscale' : ''}`}>
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" className="w-full h-full object-contain" />
      ) : (
        React.createElement(item.config.icon, { className: 'w-7 h-7 opacity-40', style: { color: item.config.color } })
      )}
    </div>
  );

  const renderItem = (item) => {
    const status = statusOf(item);
    const muted = status === 'past';
    return (
      <div
        key={item.id}
        className={`flex flex-wrap sm:flex-nowrap items-start gap-3 sm:gap-4 p-3 rounded-lg border ${
          status === 'today' ? 'border-brand-plum shadow-md bg-white' : muted ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'
        }`}
      >
        <Thumb item={item} muted={muted} />
        <div className="flex-1 min-w-0">
          <Chip item={item} muted={muted} />
          <h4 className={`mt-1.5 font-semibold leading-snug ${muted ? 'text-gray-500' : 'text-gray-900'}`}>{item.name}</h4>
          {item.subtitle && <p className={`text-sm mt-0.5 ${muted ? 'text-gray-400' : 'text-gray-600'}`}>{item.subtitle}</p>}
          {item.kind === 'event' && item.detail && !muted && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.detail}</p>
          )}
          {muted && item.kind === 'event' && (
            <p className="flex items-center gap-1 mt-1.5 text-green-600 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {item.completed && item.completed_date ? `Completed ${format(new Date(item.completed_date), 'MMM d, yyyy')}` : 'Completed'}
            </p>
          )}
        </div>
        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pl-[92px] sm:pl-0">
          <div className="sm:text-right">
            <p className={`text-sm font-semibold whitespace-nowrap ${status === 'today' ? 'text-brand-plum' : muted ? 'text-gray-400' : 'text-gray-900'}`}>
              {format(item.date, 'EEE, MMM d')}
            </p>
            <p className="text-xs text-gray-500 whitespace-nowrap">{relative(item.date)}</p>
          </div>
          {!muted && item.cal && <AddToCalendarMenu event={item.cal} />}
        </div>
      </div>
    );
  };

  // Month headers make a long list scannable.
  const withMonthHeaders = (list) => {
    const out = [];
    let lastMonth = null;
    for (const item of list) {
      const m = format(item.date, 'MMMM yyyy');
      if (m !== lastMonth) {
        out.push(<p key={`m-${m}`} className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-2">{m}</p>);
        lastMonth = m;
      }
      out.push(renderItem(item));
    }
    return out;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Your Program Timeline</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Your sessions, plus when we suggest sending the announcement (2 weeks before) and reminder (2 days before) emails.
            </p>
          </div>
          {upcomingCal.length > 1 && (
            <button
              type="button"
              onClick={() => downloadICSMulti(upcomingCal, 'SkillfulMeans_program_timeline')}
              className="inline-flex items-center gap-1.5 self-start rounded-md bg-brand-green px-3 py-2 text-xs font-semibold text-white hover:bg-[#1a3830] transition-colors whitespace-nowrap"
              title="Downloads one calendar file with every upcoming date — opens in Outlook, Apple Calendar, or import into Google Calendar"
            >
              <Download className="w-3.5 h-3.5" /> Add all {upcomingCal.length} to my calendar
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pastItems.length > 0 && (
          <div>
            <button
              onClick={() => setPastExpanded(!pastExpanded)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              {pastExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {pastItems.length} past item{pastItems.length !== 1 ? 's' : ''}
            </button>
            {pastExpanded && <div className="space-y-3 mt-3">{withMonthHeaders(pastItems)}</div>}
          </div>
        )}
        {upcomingItems.length > 0
          ? withMonthHeaders(upcomingItems)
          : <p className="text-sm text-gray-500 py-4">Nothing upcoming right now.</p>}
      </CardContent>
    </Card>
  );
}
