import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CalendarCheck, CalendarPlus, Circle, ChevronDown, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { computeProposalFulfillment, fulfillmentSummary } from '@/lib/proposalFulfillment';

const STATUS_UI = {
  not_booked: { label: 'Not booked', icon: Circle,        cls: 'bg-gray-100 text-gray-600' },
  booked:     { label: 'Booked',     icon: CalendarCheck, cls: 'bg-blue-100 text-blue-700' },
  delivered:  { label: 'Delivered',  icon: CheckCircle2,  cls: 'bg-green-100 text-green-700' },
};

function fmtEventDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

/**
 * Hook: fulfillment for one proposal, fetching its linked events itself so the
 * card can drop into any page (proposal editor, client detail, proposals list).
 */
export function useProposalFulfillment(proposal, { enabled = true } = {}) {
  const pid = proposal?.id;
  const cid = proposal?.client_id;

  const { data: services = [] } = useQuery({
    queryKey: ['delivery-services'],
    queryFn: () => base44.entities.Service.list('sort_order', 200),
    enabled: enabled && !!pid,
    staleTime: 5 * 60 * 1000,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['fulfillment-events', pid, cid],
    queryFn: async () => {
      const [byProposal, byClient] = await Promise.all([
        base44.entities.CalendarEvent.filter({ proposal_id: pid }, '-start_date', 200),
        cid ? base44.entities.CalendarEvent.filter({ client_id: cid }, '-start_date', 200) : Promise.resolve([]),
      ]);
      const seen = new Set();
      return [...byProposal, ...byClient].filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    },
    enabled: enabled && !!pid,
  });

  const fulfillment = useMemo(
    () => computeProposalFulfillment(proposal, events, services),
    [proposal, events, services]
  );
  return { fulfillment, isLoading };
}

/**
 * Fulfillment card for a proposal: per-service Not booked / Booked / Delivered,
 * a Book button per unbooked line (deep-links into Scheduling Hub with the
 * proposal + service preselected), and a "Mark fulfilled" action.
 *
 * Props:
 *  - proposal (required)
 *  - collapsible: render as a toggle row (used inside client detail)
 *  - defaultOpen
 */
export default function ProposalFulfillment({ proposal, collapsible = false, defaultOpen = true, className = '' }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  // Always compute — the collapsed header still shows the "1/3 delivered · 2 booked" summary.
  const { fulfillment: f, isLoading } = useProposalFulfillment(proposal);

  const markFulfilled = useMutation({
    mutationFn: () => base44.entities.Proposal.update(proposal.id, { status: 'fulfilled', fulfilled_date: new Date().toISOString() }),
    onSuccess: () => {
      toast.success('Proposal marked fulfilled');
      ['proposals', 'delivery-proposals', ['proposal', proposal.id]].forEach(k =>
        queryClient.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] })
      );
    },
    onError: (e) => toast.error('Could not update: ' + e.message),
  });

  if (!proposal?.id) return null;
  const isFulfilled = proposal.status === 'fulfilled';
  const summary = fulfillmentSummary(f);
  const pct = f.total > 0 ? Math.round((f.delivered / f.total) * 100) : 0;
  const bookedPct = f.total > 0 ? Math.round((f.booked / f.total) * 100) : 0;

  const header = (
    <div className="flex items-center gap-2 flex-wrap">
      {collapsible && (open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
      <span className="font-semibold text-gray-800">Fulfillment</span>
      {isFulfilled ? (
        <Badge className="bg-emerald-100 text-emerald-800"><Trophy className="w-3 h-3 mr-1" />Fulfilled</Badge>
      ) : f.total === 0 ? (
        <span className="text-xs text-gray-400 italic">no bookable services in this proposal</span>
      ) : (
        <span className={`text-sm ${f.allDelivered ? 'text-green-700' : 'text-gray-600'}`}>{summary}</span>
      )}
      {isLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
    </div>
  );

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`}>
      {collapsible ? (
        <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-xl">
          {header}
        </button>
      ) : (
        <div className="px-4 py-3">{header}</div>
      )}

      {(!collapsible || open) && f.total > 0 && (
        <div className="px-4 pb-4 space-y-3">
          {/* Progress: delivered (green) over booked (blue) */}
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 bg-blue-200" style={{ width: `${bookedPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-green-500" style={{ width: `${pct}%` }} />
          </div>

          <ul className="divide-y divide-gray-100">
            {f.items.map(item => {
              const ui = STATUS_UI[item.status];
              const Icon = ui.icon;
              const bookHref = createPageUrl('SchedulingHub') + `?bookProposalId=${proposal.id}&bookServiceId=${encodeURIComponent(item.service_id || '')}`;
              return (
                <li key={item.key} className="py-2 flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${item.status === 'delivered' ? 'text-green-600' : item.status === 'booked' ? 'text-blue-600' : 'text-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {item.name}
                      {item.rawId && <span className="ml-1.5 text-[10px] text-amber-600 font-normal">(service not in catalog)</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.label}
                      {item.price > 0 && <> · ${item.price.toLocaleString()}</>}
                      {item.eventDate && <> · {fmtEventDate(item.eventDate)}</>}
                      {item.event?.presenter && <> · {item.event.presenter}</>}
                    </div>
                  </div>
                  <Badge className={`${ui.cls} text-[11px] shrink-0`}>{ui.label}</Badge>
                  {item.status === 'not_booked' && !isFulfilled && (
                    <Link to={bookHref}>
                      <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132] h-7 px-2 text-xs">
                        <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Book
                      </Button>
                    </Link>
                  )}
                  {item.status !== 'not_booked' && item.event?.id && (
                    <Link to={createPageUrl('SchedulingHub') + `?eventId=${item.event.id}`} className="text-xs text-[#013f7c] hover:underline shrink-0">
                      view
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          {!isFulfilled && (
            <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${f.allDelivered ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
              <p className="text-xs text-gray-600">
                {f.allDelivered
                  ? 'Every service in this proposal has been delivered.'
                  : f.allBooked
                    ? 'Everything is on the calendar — mark fulfilled once the last session runs.'
                    : `${f.notBooked} service${f.notBooked === 1 ? '' : 's'} still to book.`}
              </p>
              <Button
                size="sm"
                variant={f.allDelivered ? 'default' : 'outline'}
                className={f.allDelivered ? 'bg-[#264d44] hover:bg-[#1a3830] h-7 text-xs' : 'h-7 text-xs text-gray-600'}
                disabled={markFulfilled.isPending}
                onClick={() => {
                  if (!f.allDelivered && !window.confirm('Not every service is marked delivered. Mark this proposal fulfilled anyway?')) return;
                  markFulfilled.mutate();
                }}
              >
                {markFulfilled.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trophy className="w-3.5 h-3.5 mr-1" /> Mark fulfilled</>}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
