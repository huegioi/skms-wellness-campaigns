import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import {
  Mail, Phone, ExternalLink, Copy, Check, Users, CalendarDays,
  Clock, Video, DollarSign, AlertCircle, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { getEventLens } from '@/components/scheduling/eventLenses';
import { getPresenterStatus } from '@/components/scheduling/PresenterStatusIcon';

/**
 * Admin view of the presenter bench: who is booked, who hasn't accepted yet,
 * who still owes a recording, and what we owe them — with the contact details
 * and portal link needed to act on any of it without leaving the page.
 *
 * Session→presenter matching mirrors getPresenterPortalData: presenter_id is
 * authoritative, exact full name is the legacy fallback. Keep the two in step,
 * or a presenter's dashboard row and their own portal will disagree.
 */

const money = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const portalUrl = (presenter) =>
  `${window.location.origin}/PresenterPortal?id=${presenter.unique_portal_id}`;

/** A presenter's fee for one session: per-event override, else their default rate. */
function sessionFee(event, presenter) {
  if (event.presenter_fee != null && event.presenter_fee !== '') return Number(event.presenter_fee);
  if (presenter?.default_rate != null) return Number(presenter.default_rate);
  return 0;
}

function StatTile({ icon: Icon, label, value, tone = 'neutral', hint }) {
  const tones = {
    neutral: 'bg-white border-gray-200 text-gray-900',
    attention: 'bg-amber-50 border-amber-200 text-amber-900',
    alert: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1 leading-none">{value}</p>
      {hint && <p className="text-[11px] opacity-60 mt-1.5 leading-tight">{hint}</p>}
    </div>
  );
}

/** One activity number on a presenter row. Renders nothing at zero — a clean bench stays clean. */
function Chip({ icon: Icon, count, label, tone = 'neutral', alwaysShow = false }) {
  if (!count && !alwaysShow) return null;
  const tones = {
    neutral: 'bg-gray-100 text-gray-600',
    attention: 'bg-amber-100 text-amber-800',
    alert: 'bg-red-100 text-red-700',
    good: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {count} {label}
    </span>
  );
}

/**
 * All of the dashboard's arithmetic, kept pure and exported so it can be tested
 * against fixtures rather than eyeballed in the browser.
 *
 * `events` is the raw CalendarEvent list (newest first, as the API returns it).
 */
export function summarizePresenters(presenters, events, now = new Date()) {
  // Demo rows are excluded from every count, the same as elsewhere in analytics.
  const realEvents = events.filter(e => !e.is_demo);

  const rows = presenters.map(presenter => {
    const fullName = (presenter.name || '').trim();
    const mine = realEvents.filter(e =>
      e.presenter_id === presenter.id ||
      (fullName && (e.presenter || '').trim() === fullName)
    );

    const delivery = mine.filter(e => getEventLens(e) === 'delivery');
    const upcoming = delivery
      .filter(e => e.start_date && parseISO(e.start_date) >= now && !e.completed)
      .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date));
    const past = delivery.filter(e => e.start_date && parseISO(e.start_date) < now);

    // Assigned but not yet accepted — the thing that needs a nudge before the date.
    const awaitingAccept = upcoming.filter(e => getPresenterStatus(e) === 'assigned');
    // Delivered but no recording link submitted yet.
    const recordingsDue = past.filter(e => !e.recording_link);

    // NOT shown per presenter: declines. updatePresenterSession clears presenter_id,
    // presenter_email AND presenter on a decline, so a declined session can never be
    // attributed back to whoever turned it down — a per-presenter count would always
    // read zero. Declines surface at bench level instead, as "needs a presenter".

    // Money must agree with the Payouts tab, which groups strictly by presenter_id.
    // Name-matched legacy rows are deliberately left out of the total for that reason.
    const unpaid = mine.filter(e =>
      e.presenter_id === presenter.id && e.completed && !e.presenter_paid);
    const unpaidTotal = unpaid.reduce((s, e) => s + sessionFee(e, presenter), 0);

    const lastSession = past[0] || null; // the list arrives newest-first
    const nextSession = upcoming[0] || null;

    // Anything that needs a human to chase it, so those presenters sort to the top.
    const attention = awaitingAccept.length + recordingsDue.length;

    return {
      presenter, upcoming, past, awaitingAccept, recordingsDue,
      unpaidTotal, lastSession, nextSession, attention,
      delivered: past.filter(e => e.completed).length,
    };
  });

  const ranked = [...rows].sort((a, b) => {
    if (b.attention !== a.attention) return b.attention - a.attention;
    if (a.nextSession && b.nextSession) {
      return parseISO(a.nextSession.start_date) - parseISO(b.nextSession.start_date);
    }
    if (a.nextSession) return -1;
    if (b.nextSession) return 1;
    return (a.presenter.name || '').localeCompare(b.presenter.name || '');
  });

  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  // Upcoming delivery sessions with nobody on them — including ones a presenter
  // declined, which is where declines actually become visible.
  const needsPresenter = realEvents.filter(e =>
    getEventLens(e) === 'delivery' &&
    e.start_date && parseISO(e.start_date) >= now && !e.completed &&
    !e.presenter_id && !(e.presenter || '').trim()
  );

  const totals = {
    active: presenters.filter(p => p.is_active !== false).length,
    next30: rows.reduce(
      (s, r) => s + r.upcoming.filter(e => parseISO(e.start_date) <= in30).length, 0),
    awaiting: rows.reduce((s, r) => s + r.awaitingAccept.length, 0),
    recordings: rows.reduce((s, r) => s + r.recordingsDue.length, 0),
    unpaid: rows.reduce((s, r) => s + r.unpaidTotal, 0),
    needsPresenter: needsPresenter.length,
  };

  return { rows, ranked, totals };
}

export default function PresenterDashboard() {
  const [copiedId, setCopiedId] = React.useState(null);

  const { data: presenters = [], isLoading: loadingPresenters } = useQuery({
    queryKey: ['presenters'],
    queryFn: () => base44.entities.Presenter.list('name'),
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['presenter-dashboard-events'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 500),
  });

  const copyPortalLink = (presenter) => {
    navigator.clipboard.writeText(portalUrl(presenter));
    setCopiedId(presenter.id);
    toast.success('Portal link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const now = new Date();
  const { ranked, totals } = summarizePresenters(presenters, events, now);

  if (loadingPresenters || loadingEvents) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (presenters.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 font-medium">No presenters yet</p>
        <p className="text-gray-400 text-sm mt-1">Add one on the Roster tab to see it here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bench at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatTile icon={Users} label="Active presenters" value={totals.active}
          hint={presenters.length !== totals.active ? `${presenters.length - totals.active} inactive` : null} />
        <StatTile icon={CalendarDays} label="Sessions next 30d" value={totals.next30} />
        <StatTile icon={AlertCircle} label="Needs a presenter" value={totals.needsPresenter}
          tone={totals.needsPresenter > 0 ? 'alert' : 'neutral'}
          hint={totals.needsPresenter > 0 ? 'Unassigned or declined' : null} />
        <StatTile icon={Clock} label="Awaiting acceptance" value={totals.awaiting}
          tone={totals.awaiting > 0 ? 'attention' : 'neutral'}
          hint={totals.awaiting > 0 ? 'Assigned but not confirmed' : null} />
        <StatTile icon={Video} label="Recordings due" value={totals.recordings}
          tone={totals.recordings > 0 ? 'attention' : 'neutral'}
          hint={totals.recordings > 0 ? 'Delivered, no link yet' : null} />
        <StatTile icon={DollarSign} label="Unpaid" value={money(totals.unpaid)}
          tone={totals.unpaid > 0 ? 'alert' : 'neutral'}
          hint={totals.unpaid > 0 ? 'Across completed sessions' : null} />
      </div>

      {/* Per-presenter — anything needing a chase sorts to the top */}
      <div className="space-y-3">
        {ranked.map(({ presenter, upcoming, awaitingAccept, recordingsDue,
                       unpaidTotal, lastSession, nextSession, delivered }) => {
          const isActive = presenter.is_active !== false;
          return (
            <Card key={presenter.id} className={`p-4 bg-white ${!isActive ? 'opacity-60' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{presenter.name}</h3>
                    {!isActive && <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>}
                    {presenter.sms_opt_in === true && !presenter.sms_opt_out_at && (
                      <Badge className="bg-blue-50 text-blue-700 gap-1">
                        <MessageSquare className="w-3 h-3" />SMS
                      </Badge>
                    )}
                    {presenter.sms_opt_out_at && (
                      <Badge className="bg-gray-100 text-gray-500">SMS stopped</Badge>
                    )}
                  </div>

                  {/* Contact — click to act, don't make anyone retype an address */}
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1.5 text-sm text-gray-600">
                    {presenter.email && (
                      <a href={`mailto:${presenter.email}`}
                         className="flex items-center gap-1 hover:text-[#013f7c] hover:underline min-w-0">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{presenter.email}</span>
                      </a>
                    )}
                    {presenter.phone && (
                      <a href={`tel:${presenter.phone_e164 || presenter.phone}`}
                         className="flex items-center gap-1 hover:text-[#013f7c] hover:underline">
                        <Phone className="w-3.5 h-3.5 shrink-0" />{presenter.phone}
                      </a>
                    )}
                    {presenter.default_rate != null && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />{money(presenter.default_rate)}/session
                      </span>
                    )}
                  </div>

                  {/* What's actually happening with them */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <Chip icon={CalendarDays} count={upcoming.length} label="upcoming" />
                    <Chip icon={Clock} count={awaitingAccept.length} label="awaiting accept" tone="attention" />
                    <Chip icon={Video} count={recordingsDue.length} label="recording due" tone="attention" />
                    {unpaidTotal > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                        <DollarSign className="w-3 h-3 shrink-0" />{money(unpaidTotal)} unpaid
                      </span>
                    )}
                    <Chip icon={Check} count={delivered} label="delivered" tone="good" />
                    {upcoming.length === 0 && !lastSession && (
                      <span className="text-xs text-gray-400">No sessions on the books</span>
                    )}
                  </div>

                  <div className="flex items-center gap-x-4 gap-y-0.5 flex-wrap mt-2 text-xs text-gray-500">
                    {nextSession && (
                      <span>
                        <span className="text-gray-400">Next: </span>
                        {format(parseISO(nextSession.start_date), 'MMM d')}
                        {' · '}
                        {differenceInCalendarDays(parseISO(nextSession.start_date), now) === 0
                          ? 'today'
                          : `in ${differenceInCalendarDays(parseISO(nextSession.start_date), now)}d`}
                        {nextSession.client_name ? ` · ${nextSession.client_name}` : ''}
                      </span>
                    )}
                    {lastSession && (
                      <span>
                        <span className="text-gray-400">Last: </span>
                        {format(parseISO(lastSession.start_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Portal actions — open it, or copy the link to send them */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!presenter.unique_portal_id}
                    title={presenter.unique_portal_id
                      ? 'Open this presenter’s portal in a new tab'
                      : 'No portal link yet — save the presenter on the Roster tab to generate one'}
                    onClick={() => window.open(portalUrl(presenter), '_blank', 'noopener,noreferrer')}
                    className="gap-1.5 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Portal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!presenter.unique_portal_id}
                    title="Copy the portal link"
                    onClick={() => copyPortalLink(presenter)}
                  >
                    {copiedId === presenter.id
                      ? <Check className="w-4 h-4 text-green-600" />
                      : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
