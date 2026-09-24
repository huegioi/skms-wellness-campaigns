import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar, Mail, Bell, Clock, AlertCircle, CheckCircle2,
  Users, Award, Dumbbell, Package, MessageSquare, ChevronDown, ChevronRight, Download,
} from 'lucide-react';
import { downloadICSMulti } from '@/lib/ics';
import { format, subDays, differenceInCalendarDays, isPast, isToday, setHours, setMinutes } from 'date-fns';
import AddToCalendarMenu from './AddToCalendarMenu';

// Events ingested from Google Calendar carry the invite body verbatim, which is
// HTML — Google wraps pasted content in nested <table> scaffolding. Rendered as
// plain text on the client's timeline that shows up as a wall of raw tags, so
// strip markup down to readable prose before display.
//
// Also drops the bookkeeping lines the sheet mirror writes into descriptions
// ("[Removed from sheet — client link preserved]", "Source: Events"). Those are
// internal provenance notes and mean nothing to a client.
function cleanEventDescription(raw) {
  if (!raw) return '';
  let text = String(raw);
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<\s*(br|\/p|\/div|\/tr|\/li)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }
  const INTERNAL_LINE = /^\s*(\[Removed from sheet[^\]]*\]|Source:|Client:)/i;
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !INTERNAL_LINE.test(l))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function ClientTimeline({ events = [], proposal, services = [] }) {
  const [pastExpanded, setPastExpanded] = useState(false);

  const eventTypeConfig = {
    meeting: { label: 'Meeting', noun: 'meeting', color: '#013f7c', icon: Users },
    workshop: { label: 'Workshop', noun: 'workshop', color: '#264d44', icon: Award },
    challenge: { label: '14-Day Challenge', noun: 'challenge', color: '#b45309', icon: Dumbbell },
    leadership: { label: 'Leadership Workshop', noun: 'workshop', color: '#770142', icon: Award },
    class: { label: 'Weekly Class', noun: 'class', color: '#0f766e', icon: Dumbbell },
    presentation: { label: 'Presentation', noun: 'presentation', color: '#264d44', icon: Award },
    delivery: { label: 'Wellness Box Delivery', noun: 'delivery', color: '#4d7c0f', icon: Package },
    follow_up: { label: 'Follow-up', noun: 'follow-up', color: '#441d37', icon: MessageSquare },
    other: { label: 'Session', noun: 'session', color: '#4b5563', icon: Clock },
  };
  // Only real program sessions get "send announcement / reminder" to-dos.
  const NO_EMAIL_TASKS = new Set(['meeting', 'follow_up', 'delivery']);

  const ACTIONS = {
    email_announcement: { label: 'Send announcement email', icon: Mail, color: '#013f7c', bg: '#e8eef6' },
    email_reminder: { label: 'Send reminder email', icon: Bell, color: '#b4532a', bg: '#fdeee8' },
    app_notification: { label: 'App notifications begin', icon: AlertCircle, color: '#770142', bg: '#f5e8ef' },
  };

  // Match an event to its catalog service (for the image + clean name).
  const serviceFor = (event) => {
    if (event.service_id) {
      const byId = services.find(s => s.id === event.service_id);
      if (byId) return byId;
    }
    const names = [event.service_name, String(event.title || '').split(' — ')[0]]
      .filter(Boolean).map(n => n.trim().toLowerCase());
    return services.find(s => names.includes(String(s.name || '').trim().toLowerCase())) || null;
  };
  const programName = (event, service) =>
    service?.name || event.service_name || String(event.title || '').split(' — ')[0].trim() || 'Session';

  const portalUrl = typeof window !== 'undefined' ? window.location.href : '';

  const items = [];
  for (const event of events) {
    const eventDate = new Date(event.start_date);
    if (Number.isNaN(eventDate.getTime())) continue;
    const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
    const service = serviceFor(event);
    const name = programName(event, service);
    const image = service?.images?.[0]?.url || null;
    const when = format(eventDate, 'EEE, MMM d');
    const base = { event, service, name, image, config };
    // Email to-dos land on the calendar at 9:00 AM local on the suggested day.
    const taskTime = (d) => setMinutes(setHours(d, 9), 0);

    if (!NO_EMAIL_TASKS.has(event.event_type)) {
      const annDate = taskTime(subDays(eventDate, 14));
      items.push({
        ...base, id: `${event.id}-2weeks`, date: annDate, kind: 'email_announcement',
        subtitle: `Let employees know it's coming — 2 weeks before the ${config.noun} on ${when}.`,
        cal: {
          id: `${event.id}-2weeks`, title: `Send announcement email: ${name}`, start: annDate,
          end: new Date(annDate.getTime() + 15 * 60000), alarmMinutes: 0,
          description: `Send the announcement email to your employees about ${name} on ${when}.\nEmail templates and details: ${portalUrl}`,
        },
      });
      const remDate = taskTime(subDays(eventDate, 2));
      items.push({
        ...base, id: `${event.id}-2days`, date: remDate, kind: 'email_reminder',
        subtitle: `A quick nudge — the ${config.noun} is in 2 days (${when}).`,
        cal: {
          id: `${event.id}-2days`, title: `Send reminder email: ${name}`, start: remDate,
          end: new Date(remDate.getTime() + 15 * 60000), alarmMinutes: 0,
          description: `Send the reminder email to your employees — ${name} is on ${when}.\nEmail templates and details: ${portalUrl}`,
        },
      });
      if (event.event_type === 'challenge') {
        const notif = taskTime(subDays(eventDate, 3));
        items.push({
          ...base, id: `${event.id}-app-notif`, date: notif, kind: 'app_notification',
          subtitle: 'Automatic — people who signed up get a heads-up in the app. Nothing for you to do.',
          cal: null,
        });
      }
    }

    const timeRange = event.end_date
      ? `${format(eventDate, 'h:mm a')} – ${format(new Date(event.end_date), 'h:mm a')}`
      : format(eventDate, 'h:mm a');
    items.push({
      ...base, id: event.id, date: eventDate, kind: 'event',
      subtitle: [timeRange, event.location].filter(Boolean).join(' · '),
      detail: cleanEventDescription(event.description),
      completed: event.completed, completed_date: event.completed_date,
      cal: {
        id: event.id, title: `${name} — SkillfulMeans`, start: event.start_date, end: event.end_date,
        location: event.location || '', alarmMinutes: 30,
        description: [cleanEventDescription(event.description), portalUrl && `Program details: ${portalUrl}`].filter(Boolean).join('\n\n'),
      },
    });
  }
  items.sort((a, b) => a.date - b.date);

  const statusOf = (item) => {
    if (item.completed) return 'past';
    if (isToday(item.date)) return 'today';
    if (isPast(item.date)) return 'past';
    return 'future';
  };
  const relative = (date) => {
    const days = differenceInCalendarDays(date, new Date());
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return `${Math.abs(days)} days ago`;
    return `in ${days} days`;
  };

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
