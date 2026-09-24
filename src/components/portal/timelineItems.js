import { Users, Award, Dumbbell, Package, MessageSquare, Clock, Mail, Bell, AlertCircle } from 'lucide-react';
import { format, subDays, differenceInCalendarDays, isPast, isToday, setHours, setMinutes } from 'date-fns';

/**
 * Shared "program timeline" logic for the client portal — the Timeline tab and
 * the Home tab's "Your next to-do" / "Next session" cards both read from this,
 * so they always agree on what's due and when.
 */

// Events ingested from Google Calendar carry the invite body verbatim, which is
// HTML — Google wraps pasted content in nested <table> scaffolding. Rendered as
// plain text on the client's timeline that shows up as a wall of raw tags, so
// strip markup down to readable prose before display.
//
// Also drops the bookkeeping lines the sheet mirror writes into descriptions
// ("[Removed from sheet — client link preserved]", "Source: Events"). Those are
// internal provenance notes and mean nothing to a client.
export function cleanEventDescription(raw) {
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


export const EVENT_TYPE_CONFIG = {
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

export const TIMELINE_ACTIONS = {
  email_announcement: { label: 'Send announcement email', icon: Mail, color: '#013f7c', bg: '#e8eef6' },
  email_reminder: { label: 'Send reminder email', icon: Bell, color: '#b4532a', bg: '#fdeee8' },
  app_notification: { label: 'App notifications begin', icon: AlertCircle, color: '#770142', bg: '#f5e8ef' },
};

/** Match a calendar event to its catalog service (image + clean name). */
export function serviceForEvent(event, services = []) {
  if (event.service_id) {
    const byId = services.find(s => s.id === event.service_id);
    if (byId) return byId;
  }
  const names = [event.service_name, String(event.title || '').split(' — ')[0]]
    .filter(Boolean).map(n => n.trim().toLowerCase());
  return services.find(s => names.includes(String(s.name || '').trim().toLowerCase())) || null;
}

export function programNameForEvent(event, service) {
  return service?.name || event.service_name || String(event.title || '').split(' — ')[0].trim() || 'Session';
}

/** Every timeline item (email to-dos + sessions), sorted by date. */
export function buildTimelineItems(events = [], services = [], portalUrl = '') {
  const items = [];
  for (const event of events) {
    const eventDate = new Date(event.start_date);
    if (Number.isNaN(eventDate.getTime())) continue;
    const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.other;
    const service = serviceForEvent(event, services);
    const name = programNameForEvent(event, service);
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
  return items;
}

export function timelineStatus(item) {
  if (item.completed) return 'past';
  if (isToday(item.date)) return 'today';
  if (isPast(item.date)) return 'past';
  return 'future';
}

export function relativeDay(date) {
  const days = differenceInCalendarDays(date, new Date());
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}
