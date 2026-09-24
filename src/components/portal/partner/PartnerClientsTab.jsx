import React from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, FileBarChart, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrokerFeedbackRollup from '../BrokerFeedbackRollup';
import ROIDashboard from '../ROIDashboard';
import AddToCalendarMenu from '../AddToCalendarMenu';
import { Thumb, CardShell } from '../PortalCards';
import { relativeDay } from '../timelineItems';
import { BAND_TONE_CLASSES } from '@/components/feedback/instrumentMeta';

/**
 * Referral partner portal — Clients (book of business), 2026-09-24.
 *  - Portfolio numbers (BrokerFeedbackRollup, per-client breakdown hidden —
 *    the client cards below replace it)
 *  - One card per client: program progress, next session, headline results
 *  - Upcoming sessions across the whole book, each with Add to calendar
 *  - Click a card → that client's full results (ROIDashboard)
 */

const MIN_N = 5;

export default function PartnerClientsTab({ clientCompanies = [], services = [], portalId, book, selectedClient, onSelectClient }) {
  const { clients, upcoming } = book;

  if (selectedClient) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => onSelectClient(null)} className="gap-1 text-xs text-gray-500">
            <ArrowLeft className="w-3 h-3" /> All clients
          </Button>
          <span className="text-sm font-semibold text-gray-700">{selectedClient.company}</span>
        </div>
        <ROIDashboard
          clientId={selectedClient.id}
          clientCompany={selectedClient.company}
          services={services}
          portalId={portalId}
          showReportButton={true}
          onGenerateReport={() => window.open(`${window.location.origin}/ClientReport?client_id=${selectedClient.id}&portal_id=${portalId}`, '_blank')}
        />
      </div>
    );
  }

  if (clientCompanies.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-500">
        <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No clients in your book yet.</p>
        <p className="text-sm mt-1">When an employer you refer becomes a client, their programs and results appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BrokerFeedbackRollup clientCompanies={clientCompanies} services={services} portalId={portalId} showBreakdown={false} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Your clients</p>
        <div className="grid gap-4 md:grid-cols-2">
          {clients.map(c => <ClientCard key={c.client.id} data={c} portalId={portalId} onOpen={() => onSelectClient(c.client)} />)}
        </div>
      </div>

      <CardShell eyebrow="Upcoming sessions across your clients">
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions on the calendar right now.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.slice(0, 10).map(u => {
              const d = new Date(u.event.start_date);
              return (
                <li key={u.event.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
                  <Thumb image={u.image} size="w-12 h-12" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 leading-snug">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.company}</p>
                  </div>
                  <div className="text-right mr-1">
                    <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(d, 'EEE, MMM d')}</p>
                    <p className="text-xs text-gray-500 whitespace-nowrap">{format(d, 'h:mm a')} · {relativeDay(d)}</p>
                  </div>
                  <AddToCalendarMenu event={u.cal} />
                </li>
              );
            })}
          </ul>
        )}
      </CardShell>
    </div>
  );
}

function ClientCard({ data, portalId, onOpen }) {
  const { client, programs, counts, nextSession, results } = data;
  const total = programs.length;
  const pct = (n) => (total ? (n / total) * 100 : 0);
  const enps = results?.enps;
  const enpsReady = enps?.enps != null && enps.n >= MIN_N;
  const wb = results?.wellbeing;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{client.company}</p>
          {client.name && client.name !== client.company && <p className="text-xs text-gray-400 truncate">{client.name}</p>}
        </div>
        {total > 0 && (
          <p className="text-xs text-gray-500 whitespace-nowrap">{counts.delivered} of {total} delivered</p>
        )}
      </div>

      {total > 0 ? (
        <>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="bg-brand-green" style={{ width: `${pct(counts.delivered)}%` }} />
            <div className="bg-brand-navy/70" style={{ width: `${pct(counts.booked)}%` }} />
          </div>
          <div className="mt-3 flex gap-2 overflow-hidden">
            {programs.slice(0, 5).map(p => (
              <div key={p.service.id} title={`${p.service.name} — ${p.status === 'delivered' ? 'delivered' : p.status === 'booked' ? 'booked' : 'not yet scheduled'}`}
                className={p.status === 'unscheduled' ? 'opacity-40' : ''}>
                <Thumb image={p.service.images?.[0]?.url} size="w-12 h-12" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400 mt-2">No accepted program yet.</p>
      )}

      {nextSession && (
        <p className="mt-3 text-sm text-gray-600 inline-flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-brand-green shrink-0" />
          <span className="truncate">Next: <span className="font-medium text-gray-800">{nextSession.name}</span> · {format(new Date(nextSession.event.start_date), 'EEE, MMM d')}</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
        <div>
          <p className="text-[11px] text-gray-400">People</p>
          <p className="text-lg font-bold text-brand-navy">{results?.people ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">eNPS</p>
          <p className="text-lg font-bold text-brand-navy">{enpsReady ? `${enps.enps >= 0 ? '+' : ''}${enps.enps}` : '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">Wellbeing</p>
          {wb?.mode === 'change' ? (
            <p className={`text-lg font-bold ${wb.isGood ? 'text-green-700' : 'text-red-600'}`}>{wb.value >= 0 ? '+' : ''}{wb.value.toFixed(0)}</p>
          ) : wb?.mode === 'baseline' ? (
            <p className="text-lg font-bold text-brand-navy">
              {wb.value.toFixed(0)}{' '}
              {wb.band && <span className={`align-middle px-1.5 py-0.5 rounded text-[10px] font-semibold ${BAND_TONE_CLASSES[wb.band.tone]}`}>{wb.band.label}</span>}
            </p>
          ) : (
            <p className="text-lg font-bold text-gray-300">—</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onOpen} className="inline-flex items-center gap-1 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#012d5a]">
          View full results <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <a
          href={`${window.location.origin}/ClientReport?client_id=${client.id}&portal_id=${portalId}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-green hover:text-brand-green"
        >
          <FileBarChart className="w-3.5 h-3.5" /> Report
        </a>
      </div>
    </div>
  );
}
