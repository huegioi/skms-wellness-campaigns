import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowRight, CalendarCheck, CheckCircle2, Circle, Clock, MapPin, Sparkles, FolderOpen, Users, BarChart3, Mail, CalendarPlus,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AddToCalendarMenu from './AddToCalendarMenu';
import {
  buildTimelineItems, timelineStatus, relativeDay, TIMELINE_ACTIONS, serviceForEvent,
} from './timelineItems';
import { programStatuses, statusCounts, NON_PROGRAM_TYPES } from './programStatus';
import { NPS_BENCHMARK_LABEL } from '@/lib/npsBenchmark';
import { contactsForClient } from '@/lib/portalContacts';
import { BAND_TONE_CLASSES } from '@/components/feedback/instrumentMeta';
import { summarizeResults } from './portalResults';
import { Thumb, CardShell, ResultTile, HighlightsCard, ContactCard } from './PortalCards';

/**
 * Client portal Home (overhauled 2026-09-24).
 *
 *  1. Welcome + program progress bar (delivered / booked / not yet scheduled)
 *  2. "Your next to-do" + "Next session"          — or, before the first
 *     session, a Getting-started checklist
 *  3. Headline results (people · eNPS vs industry · wellbeing)  [after 1st session]
 *  4. Programs not yet scheduled → Book
 *  5. Highlights feed + Your SkillfulMeans contact
 */

const MIN_N = 5;

export default function ClientHomeTab({ client, events = [], proposals = [], services = [], stats, onNavigate }) {
  const portalUrl = typeof window !== 'undefined' ? window.location.href : '';
  const timeline = useMemo(() => buildTimelineItems(events, services, portalUrl), [events, services, portalUrl]);
  const upcoming = timeline.filter(i => timelineStatus(i) !== 'past');
  const nextTodo = upcoming.find(i => i.kind === 'email_announcement' || i.kind === 'email_reminder') || null;
  const nextSession = upcoming.find(i => i.kind === 'event' && !NON_PROGRAM_TYPES.has(i.event.event_type))
    || upcoming.find(i => i.kind === 'event') || null;

  // ── Program status: delivered / booked / not yet scheduled ────────────────
  const programs = useMemo(() => programStatuses(proposals, services, events), [proposals, services, events]);
  const counts = statusCounts(programs);
  const isNewClient = counts.delivered === 0;

  // ── Results (same query + cache as the Feedback tab's dashboard) ─────────
  const { data: roiData } = useQuery({
    queryKey: ['roi-data', client?.id, client?.portal_token, undefined],
    queryFn: async () => {
      const payload = { client_id: client.id };
      if (client.portal_token) payload.client_token = client.portal_token;
      const res = await base44.functions.invoke('getRoiData', payload);
      return res.data;
    },
    enabled: !!client?.id && !isNewClient,
  });
  const results = useMemo(() => summarizeResults(roiData, stats), [roiData, stats]);

  const highlights = useMemo(
    () => buildHighlights({ programs, roiData, results }),
    [programs, roiData, results]
  );
  const unscheduled = programs.filter(p => p.status === 'unscheduled');
  const contacts = contactsForClient(client);

  return (
    <div className="space-y-6">
      <WelcomeHeader client={client} counts={counts} total={programs.length} />

      {isNewClient ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <GettingStarted timeline={timeline} counts={counts} onNavigate={onNavigate} />
          </div>
          <div className="lg:col-span-2">
            <NextSessionCard item={nextSession} onNavigate={onNavigate} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <NextTodoCard item={nextTodo} onNavigate={onNavigate} />
          <NextSessionCard item={nextSession} onNavigate={onNavigate} />
        </div>
      )}

      {!isNewClient && <ResultsRow results={results} onNavigate={onNavigate} />}

      {unscheduled.length > 0 && <NotScheduledCard programs={unscheduled} onNavigate={onNavigate} />}

      <div className="grid gap-4 md:grid-cols-3">
        {!isNewClient && highlights.length > 0 && (
          <div className="md:col-span-2"><HighlightsCard items={highlights} onNavigate={onNavigate} /></div>
        )}
        <div className={!isNewClient && highlights.length > 0 ? '' : 'md:col-span-3'}>
          <ContactCard contacts={contacts} company={client?.company} wide={isNewClient || highlights.length === 0} />
        </div>
      </div>
    </div>
  );
}

// ── Data helpers ─────────────────────────────────────────────────────────────

function buildHighlights({ programs, roiData, results }) {
  const out = [];
  for (const p of programs) {
    const available = (p.service.resources || []).filter(r => !r.locked);
    if (p.status === 'delivered' && available.length && p.lastHeldDate) {
      out.push({
        key: `res-${p.service.id}`, date: p.lastHeldDate, icon: FolderOpen, tab: 'resources',
        text: `${p.service.name} resources are now available`,
        sub: `${available.length} ${available.length === 1 ? 'item' : 'items'} — recordings, slides & handouts`,
      });
    }
  }
  for (const pr of (roiData?.participation || [])) {
    if ((pr.people || []).length >= MIN_N) {
      out.push({
        key: `part-${pr.key}`, date: pr.date, icon: Users, tab: 'feedback',
        text: `${pr.people.length} people took part in ${pr.title}`,
        sub: 'See participation over time',
      });
    }
  }
  if (results.wellbeing?.mode === 'change' && results.lastWho5) {
    out.push({ key: 'wb-change', date: results.lastWho5, icon: BarChart3, tab: 'feedback',
      text: 'Before-and-after wellbeing results are in', sub: 'See what changed for your team' });
  } else if (results.wellbeing?.mode === 'baseline' && results.firstWho5) {
    out.push({ key: 'wb-base', date: results.firstWho5, icon: BarChart3, tab: 'feedback',
      text: "Your team's wellbeing baseline is in", sub: 'See where your team is starting from' });
  }
  return out.sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 4);
}

// ── Sections ────────────────────────────────────────────────────────────────

function WelcomeHeader({ client, counts, total }) {
  const first = String(client?.name || '').trim().split(/\s+/)[0];
  const showName = first && String(client?.name || '').trim() !== String(client?.company || '').trim();
  const pct = (n) => (total ? (n / total) * 100 : 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
      <h2 className="text-2xl font-bold text-brand-navy">{showName ? `Welcome back, ${first}` : 'Welcome back'}</h2>
      {total > 0 ? (
        <>
          <p className="text-gray-600 mt-1">
            Your program: <span className="font-semibold text-gray-800">{counts.delivered} of {total}</span>{' '}
            {total === 1 ? 'program' : 'programs'} delivered
            {counts.booked > 0 && <> · {counts.booked} booked</>}
            {counts.unscheduled > 0 && <> · {counts.unscheduled} not yet scheduled</>}
          </p>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100" role="img"
            aria-label={`${counts.delivered} delivered, ${counts.booked} booked, ${counts.unscheduled} not yet scheduled`}>
            <div className="bg-brand-green" style={{ width: `${pct(counts.delivered)}%` }} />
            <div className="bg-brand-navy/70" style={{ width: `${pct(counts.booked)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-green" />Delivered</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-navy/70" />Booked</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200" />Not yet scheduled</span>
          </div>
        </>
      ) : (
        <p className="text-gray-600 mt-1">Your wellness program with SkillfulMeans.</p>
      )}
    </div>
  );
}

function NextTodoCard({ item, onNavigate }) {
  if (!item) {
    return (
      <CardShell eyebrow="Your next to-do">
        <div className="flex items-center gap-3 text-gray-600">
          <CheckCircle2 className="w-6 h-6 text-brand-green" />
          <p>You're all caught up — nothing to send right now.</p>
        </div>
      </CardShell>
    );
  }
  const a = TIMELINE_ACTIONS[item.kind];
  const Icon = a.icon;
  return (
    <CardShell
      eyebrow="Your next to-do"
      footer={
        <button onClick={() => onNavigate('timeline')} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline self-start">
          See full timeline <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="flex gap-4">
        <Thumb image={item.image} />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: a.color, backgroundColor: a.bg }}>
            <Icon className="w-3 h-3" /> {a.label}
          </span>
          <p className="mt-1.5 font-semibold text-gray-900 leading-snug">{item.name}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            By <span className="font-medium text-gray-800">{format(item.date, 'EEE, MMM d')}</span> · {relativeDay(item.date)}
          </p>
          <div className="mt-3"><AddToCalendarMenu event={item.cal} /></div>
        </div>
      </div>
    </CardShell>
  );
}

function NextSessionCard({ item, onNavigate }) {
  if (!item) {
    return (
      <CardShell eyebrow="Next session">
        <p className="text-gray-600">No sessions on the calendar yet.</p>
        <button onClick={() => onNavigate('book')} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-[#1a3830]">
          <CalendarPlus className="w-4 h-4" /> Book a session
        </button>
      </CardShell>
    );
  }
  const e = item.event;
  const isLink = e.location && /^https?:\/\//i.test(e.location);
  const Icon = item.config.icon;
  return (
    <CardShell eyebrow="Next session">
      <div className="flex gap-4">
        <Thumb image={item.image} />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: item.config.color }}>
            <Icon className="w-3 h-3" /> {item.config.label}
          </span>
          <p className="mt-1.5 font-semibold text-gray-900 leading-snug">{item.name}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            <span className="font-medium text-gray-800">{format(item.date, 'EEE, MMM d')}</span> · {relativeDay(item.date)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{format(item.date, 'h:mm a')}</span>
            {e.location && (isLink ? (
              <a href={e.location} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-navy hover:underline">
                <MapPin className="w-3.5 h-3.5" />Join link
              </a>
            ) : (
              <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{e.location}</span>
            ))}
          </div>
          <div className="mt-3"><AddToCalendarMenu event={item.cal} /></div>
        </div>
      </div>
    </CardShell>
  );
}

function GettingStarted({ timeline, counts, onNavigate }) {
  const firstSession = timeline.find(i => i.kind === 'event' && !NON_PROGRAM_TYPES.has(i.event.event_type) && timelineStatus(i) !== 'past');
  const eid = firstSession?.event?.id;
  const ann = eid && timeline.find(i => i.id === `${eid}-2weeks`);
  const rem = eid && timeline.find(i => i.id === `${eid}-2days`);
  const done = (i) => i && timelineStatus(i) === 'past';
  const steps = [
    {
      title: 'Schedule your first session',
      done: counts.booked > 0,
      sub: counts.booked > 0 ? `Booked — ${firstSession ? `${firstSession.name} on ${format(firstSession.date, 'EEE, MMM d')}` : 'on your calendar'}` : 'Pick a date for your first program.',
      action: counts.booked > 0 ? null : <button onClick={() => onNavigate('book')} className="text-sm font-medium text-brand-navy hover:underline">Book now →</button>,
    },
    {
      title: 'Announce it to your employees',
      done: done(ann),
      sub: ann ? `Suggested: ${format(ann.date, 'EEE, MMM d')} (2 weeks before)` : 'Two weeks before your session.',
      action: ann && !done(ann) ? <AddToCalendarMenu event={ann.cal} /> : null,
    },
    {
      title: 'Send a reminder',
      done: done(rem),
      sub: rem ? `Suggested: ${format(rem.date, 'EEE, MMM d')} (2 days before)` : 'Two days before your session.',
      action: rem && !done(rem) ? <AddToCalendarMenu event={rem.cal} /> : null,
    },
    {
      title: 'See your results & resources',
      done: false,
      sub: 'Unlocks after your first session — participation, feedback, and session materials.',
      action: null,
    },
  ];
  return (
    <CardShell eyebrow="Getting started">
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            {s.done
              ? <CheckCircle2 className="w-6 h-6 text-brand-green shrink-0" />
              : <span className="w-6 h-6 shrink-0 rounded-full border-2 border-gray-200 text-xs font-semibold text-gray-400 flex items-center justify-center">{i + 1}</span>}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${s.done ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'}`}>{s.title}</p>
              <p className="text-sm text-gray-500">{s.sub}</p>
            </div>
            {s.action && <div className="shrink-0">{s.action}</div>}
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

function ResultsRow({ results, onNavigate }) {
  const { people, programsWithPeople, enps, wellbeing } = results;
  const enpsReady = enps?.enps != null && enps.n >= MIN_N;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Your results so far</p>
        <button onClick={() => onNavigate('feedback')} className="inline-flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
          See full results <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <ResultTile
          label="People engaged"
          value={people ?? '—'}
          caption={programsWithPeople ? `Across ${programsWithPeople} ${programsWithPeople === 1 ? 'program' : 'programs'}` : 'Distinct participants across programs'}
        />
        <ResultTile
          label="eNPS"
          value={enpsReady ? `${enps.enps >= 0 ? '+' : ''}${enps.enps}` : '—'}
          caption={enpsReady ? `${enps.n} responses` : 'Collecting data'}
          extra={NPS_BENCHMARK_LABEL}
        />
        {wellbeing?.mode === 'change' ? (
          <ResultTile
            label="Wellbeing change"
            value={`${wellbeing.value >= 0 ? '+' : ''}${wellbeing.value.toFixed(0)}`}
            caption={`WHO-5, before → after · ${wellbeing.n} matched`}
            tone={{ label: wellbeing.isGood ? 'Improved' : 'Declined', cls: wellbeing.isGood ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700' }}
          />
        ) : wellbeing?.mode === 'baseline' ? (
          <ResultTile
            label="Wellbeing"
            value={wellbeing.value.toFixed(0)}
            caption={`WHO-5 baseline (0–100) · ${wellbeing.n} people · follow-up pending`}
            tone={wellbeing.band ? { label: wellbeing.band.label, cls: BAND_TONE_CLASSES[wellbeing.band.tone] } : null}
          />
        ) : (
          <ResultTile label="Wellbeing" value="—" caption="Collecting data" />
        )}
      </div>
    </div>
  );
}

function NotScheduledCard({ programs, onNavigate }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-amber-900">
            {programs.length === 1 ? '1 program isn’t scheduled yet' : `${programs.length} programs aren’t scheduled yet`}
          </p>
          <p className="text-sm text-amber-800/80">Pick a date so your team can plan for it.</p>
        </div>
        <button onClick={() => onNavigate('book')} className="inline-flex items-center gap-1.5 self-start rounded-md bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-[#1a3830]">
          <CalendarCheck className="w-4 h-4" /> Book a date
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {programs.map(p => (
          <div key={p.service.id} className="flex items-center gap-2 bg-white rounded-lg border border-amber-100 pr-3">
            <Thumb image={p.service.images?.[0]?.url} size="w-12 h-12" />
            <p className="text-sm font-medium text-gray-800 max-w-[220px] leading-snug">{p.service.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

