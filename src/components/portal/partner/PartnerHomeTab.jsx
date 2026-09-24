import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ArrowRight, CalendarDays, Clock3, FileBarChart, Megaphone, UserPlus, Users, BarChart3, Bell } from 'lucide-react';
import AddToCalendarMenu from '../AddToCalendarMenu';
import { Thumb, CardShell, ResultTile, HighlightsCard, ContactCard } from '../PortalCards';
import { relativeDay } from '../timelineItems';
import { NPS_BENCHMARK_LABEL } from '@/lib/npsBenchmark';
import { PARTNER_PORTAL_CONTACT } from '@/lib/portalContacts';
import { BAND_TONE_CLASSES } from '@/components/feedback/instrumentMeta';

/**
 * Referral partner portal — Home (2026-09-24). Mirrors the client portal Home:
 * welcome + pipeline bar, next steps, headline results, highlights, contact.
 */

const MIN_N = 5;
const STAGES = [
  { key: 'review', label: 'Under review', statuses: ['pending_review', 'submitted'], color: 'bg-amber-400' },
  { key: 'contacted', label: 'Contacted', statuses: ['contacted'], color: 'bg-brand-navy/50' },
  { key: 'client', label: 'Became clients', statuses: ['converted_to_client'], color: 'bg-brand-navy' },
  { key: 'purchased', label: 'Purchased', statuses: ['purchased', 'commission_paid'], color: 'bg-brand-green' },
];

export default function PartnerHomeTab({
  partner, referrals = [], activities = [], commissionsEnabled, commissionSummary = {},
  book, portalId, onNavigate,
}) {
  const { clients, upcoming, bookResults } = book;
  const first = String(partner?.name || '').trim().split(/\s+/)[0];

  const stageCounts = STAGES.map(st => ({ ...st, n: referrals.filter(r => st.statuses.includes(r.status)).length }));
  const pipelineTotal = stageCounts.reduce((s, x) => s + x.n, 0);

  const nextSteps = useMemo(() => {
    const out = [];
    for (const u of upcoming.slice(0, 2)) {
      out.push({ key: `up-${u.event.id}`, kind: 'session', item: u });
    }
    for (const c of clients) {
      const uns = c.programs.filter(p => p.status === 'unscheduled');
      if (uns.length) out.push({ key: `uns-${c.client.id}`, kind: 'unscheduled', client: c.client, programs: uns });
    }
    for (const c of clients) {
      if (c.counts.delivered > 0 && c.results?.people >= MIN_N) {
        out.push({ key: `win-${c.client.id}`, kind: 'win', client: c.client, results: c.results });
      }
    }
    const lastReferral = referrals.map(r => r.referral_date).filter(Boolean).sort().slice(-1)[0];
    if (!lastReferral || (Date.now() - new Date(lastReferral).getTime()) > 30 * 86400000) {
      out.push({ key: 'refer', kind: 'refer' });
    }
    return out.slice(0, 4);
  }, [upcoming, clients, referrals]);

  const highlights = useMemo(() => {
    const out = [];
    for (const c of clients) {
      for (const p of c.participation) {
        if ((p.people || []).length >= MIN_N) {
          out.push({ key: `p-${p.key}`, date: p.date, icon: Users, tab: 'clients',
            text: `${c.client.company}: ${p.people.length} people took part in ${p.title}`, sub: 'See client results' });
        }
      }
      if (c.results?.wellbeing?.mode === 'baseline' && c.results.firstWho5) {
        out.push({ key: `wb-${c.client.id}`, date: c.results.firstWho5, icon: BarChart3, tab: 'clients',
          text: `${c.client.company}: wellbeing baseline is in`, sub: 'Where their team is starting from' });
      }
      if (c.results?.wellbeing?.mode === 'change' && c.results.lastWho5) {
        out.push({ key: `wbc-${c.client.id}`, date: c.results.lastWho5, icon: BarChart3, tab: 'clients',
          text: `${c.client.company}: before-and-after results are in`, sub: 'See what changed' });
      }
    }
    for (const a of activities) {
      out.push({ key: `a-${a.id}`, date: a.activity_date, icon: Bell, tab: 'referrals', text: a.message, sub: 'Referral update' });
    }
    return out.filter(h => h.date).sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 5);
  }, [clients, activities]);

  const enps = bookResults?.enps;
  const enpsReady = enps?.enps != null && enps.n >= MIN_N;
  const wb = bookResults?.wellbeing;

  return (
    <div className="space-y-6">
      {/* Welcome + pipeline */}
      <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-2xl font-bold text-brand-navy">{first ? `Welcome back, ${first}` : 'Welcome back'}</h2>
        <p className="text-gray-600 mt-1">
          <span className="font-semibold text-gray-800">{clients.length}</span> {clients.length === 1 ? 'client' : 'clients'} in your book
          {pipelineTotal > 0 && <> · {pipelineTotal} {pipelineTotal === 1 ? 'referral' : 'referrals'}</>}
        </p>
        {pipelineTotal > 0 && (
          <>
            <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100" role="img"
              aria-label={stageCounts.map(s => `${s.n} ${s.label}`).join(', ')}>
              {stageCounts.map(s => (
                <div key={s.key} className={s.color} style={{ width: `${(s.n / pipelineTotal) * 100}%` }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {stageCounts.map(s => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />{s.label} <span className="font-semibold text-gray-700">{s.n}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <CardShell eyebrow="Your next steps">
          <ul className="divide-y divide-gray-100">
            {nextSteps.map(s => <NextStepRow key={s.key} step={s} portalId={portalId} onNavigate={onNavigate} />)}
          </ul>
        </CardShell>
      )}

      {/* Headline results across the book */}
      {clients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Across your clients</p>
            <button onClick={() => onNavigate('clients')} className="inline-flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
              See client results <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <ResultTile label="People engaged" value={bookResults?.people ?? '—'}
              caption={bookResults?.programsWithPeople ? `Across ${bookResults.programsWithPeople} ${bookResults.programsWithPeople === 1 ? 'program' : 'programs'}` : 'Unique people who took part'} />
            <ResultTile label="eNPS" value={enpsReady ? `${enps.enps >= 0 ? '+' : ''}${enps.enps}` : '—'}
              caption={enpsReady ? `${enps.n} responses` : 'Collecting data'} extra={NPS_BENCHMARK_LABEL} />
            {wb?.mode === 'change' ? (
              <ResultTile label="Wellbeing change" value={`${wb.value >= 0 ? '+' : ''}${wb.value.toFixed(0)}`}
                caption={`WHO-5, before → after · ${wb.n} matched`}
                tone={{ label: wb.isGood ? 'Improved' : 'Declined', cls: wb.isGood ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700' }} />
            ) : wb?.mode === 'baseline' ? (
              <ResultTile label="Wellbeing" value={wb.value.toFixed(0)} caption={`WHO-5 baseline · ${wb.n} people`}
                tone={wb.band ? { label: wb.band.label, cls: BAND_TONE_CLASSES[wb.band.tone] } : null} />
            ) : (
              <ResultTile label="Wellbeing" value="—" caption="Collecting data" />
            )}
            {commissionsEnabled ? (
              <ResultTile label="Commission earned" value={`$${Math.round(commissionSummary.total_earned || 0).toLocaleString()}`}
                caption={commissionSummary.pending > 0 ? `$${Math.round(commissionSummary.pending).toLocaleString()} pending` : 'To date'} />
            ) : (
              <ResultTile label="Referrals" value={referrals.length} caption="Submitted to date" />
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.length > 0 && (
          <div className="md:col-span-2"><HighlightsCard items={highlights} onNavigate={onNavigate} /></div>
        )}
        <div className={highlights.length > 0 ? '' : 'md:col-span-3'}>
          <ContactCard contacts={[PARTNER_PORTAL_CONTACT]} company={partner?.company} wide={highlights.length === 0} />
        </div>
      </div>
    </div>
  );
}

function NextStepRow({ step, portalId, onNavigate }) {
  if (step.kind === 'session') {
    const u = step.item;
    const d = new Date(u.event.start_date);
    return (
      <li className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
        <Thumb image={u.image} size="w-12 h-12" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-green inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Upcoming client session</p>
          <p className="font-medium text-gray-900 leading-snug">{u.company} · {u.name}</p>
          <p className="text-xs text-gray-500">{format(d, 'EEE, MMM d · h:mm a')} · {relativeDay(d)}</p>
        </div>
        <AddToCalendarMenu event={u.cal} />
      </li>
    );
  }
  if (step.kind === 'unscheduled') {
    return (
      <li className="flex items-center gap-3 py-3">
        <span className="w-12 h-12 rounded-md bg-amber-50 flex items-center justify-center shrink-0"><Clock3 className="w-5 h-5 text-amber-600" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Not yet scheduled</p>
          <p className="font-medium text-gray-900 leading-snug">
            {step.client.company} hasn’t scheduled {step.programs.length === 1 ? step.programs[0].service.name : `${step.programs.length} programs`} yet
          </p>
          <p className="text-xs text-gray-500">A quick nudge from you helps them get it on the calendar.</p>
        </div>
      </li>
    );
  }
  if (step.kind === 'win') {
    return (
      <li className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
        <span className="w-12 h-12 rounded-md bg-brand-green/10 flex items-center justify-center shrink-0"><Megaphone className="w-5 h-5 text-brand-green" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-green">Share a win</p>
          <p className="font-medium text-gray-900 leading-snug">{step.client.company}: {step.results.people} people engaged so far</p>
          <p className="text-xs text-gray-500">A results report makes a great check-in with your client.</p>
        </div>
        <a
          href={`${window.location.origin}/ClientReport?client_id=${step.client.id}&portal_id=${portalId}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-green hover:text-brand-green"
        >
          <FileBarChart className="w-3.5 h-3.5" /> Open report
        </a>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
      <span className="w-12 h-12 rounded-md bg-brand-navy/10 flex items-center justify-center shrink-0"><UserPlus className="w-5 h-5 text-brand-navy" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-navy">Refer an employer</p>
        <p className="font-medium text-gray-900 leading-snug">Know another employer who’d benefit?</p>
        <p className="text-xs text-gray-500">A name and company is enough — we take it from there.</p>
      </div>
      <button onClick={() => onNavigate('referrals')} className="inline-flex items-center gap-1.5 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#012d5a]">
        Submit a referral
      </button>
    </li>
  );
}
