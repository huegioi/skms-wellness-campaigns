import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { PROPOSAL_STATUS_CONFIG } from '@/lib/statusConfig';
import { DemoOrInternalBadge } from '@/components/shared/DemoBadge';
import {
  OPEN_PROPOSAL_STATUSES,
  computeProposalFulfillment,
  getProposalParty,
} from '@/lib/proposalFulfillment';

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}
function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

/**
 * Searchable proposal picker for "Book Service → From Proposal".
 *
 * Row layout (William's spec): Company · contact · $total · date · status · "x of y booked".
 * Default list = open proposals (sent / viewed / accepted), demo + internal hidden.
 * "Show all" reveals drafts, declined, fulfilled, demo and internal records.
 */
export default function ProposalPicker({
  proposals = [],
  clients = [],
  events = [],
  services = [],
  value = '',
  onChange,
  placeholder = 'Search proposals by company or contact…',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const list = proposals.map(p => {
      const party = getProposalParty(p, clients);
      const f = computeProposalFulfillment(p, events, services);
      const status = p.status || 'draft';
      // Internal = flagged on the proposal OR on its linked client (the "SkillfulMeans (internal)" test client)
      const internal = !!(p.is_internal || party.client?.is_internal);
      const demo = !!(p.is_demo || party.client?.is_demo);
      const hidden = demo || internal || !OPEN_PROPOSAL_STATUSES.includes(status);
      return { proposal: p, party, f, status, hidden, badgeRecord: { is_demo: demo, is_internal: internal } };
    });
    const visible = showAll ? list : list.filter(r => !r.hidden);
    // Always keep the currently selected row reachable
    if (value && !visible.some(r => r.proposal.id === value)) {
      const cur = list.find(r => r.proposal.id === value);
      if (cur) visible.push(cur);
    }
    return visible.sort((a, b) =>
      a.party.company.localeCompare(b.party.company, undefined, { sensitivity: 'base' }) ||
      (new Date(b.proposal.created_date) - new Date(a.proposal.created_date))
    );
  }, [proposals, clients, events, services, showAll, value]);

  const hiddenCount = useMemo(() => {
    const byId = {};
    for (const c of clients) byId[c.id] = c;
    return proposals.filter(p => {
      const c = p.client_id ? byId[p.client_id] : null;
      return p.is_demo || p.is_internal || c?.is_demo || c?.is_internal || !OPEN_PROPOSAL_STATUSES.includes(p.status || 'draft');
    }).length;
  }, [proposals, clients]);

  const selected = rows.find(r => r.proposal.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between h-auto min-h-10 py-2 border-gray-200 bg-gray-50 hover:bg-white font-normal ${className}`}
        >
          {selected ? (
            <span className="flex items-center gap-2 text-left min-w-0 flex-1 overflow-hidden">
              <Building2 className="w-4 h-4 text-[#770142] shrink-0" />
              <span className="font-semibold text-gray-800 truncate">{selected.party.company}</span>
              {selected.party.contact && <span className="text-gray-500 truncate shrink-[2]">· {selected.party.contact}</span>}
              <span className="text-gray-700 shrink-0">· {fmtMoney(selected.proposal.total_amount)}</span>
              <span className="text-gray-400 shrink-0 hidden sm:inline">· {fmtDate(selected.proposal.created_date)}</span>
            </span>
          ) : (
            <span className="text-gray-500">Choose a proposal…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>
              <div className="py-4 text-sm text-gray-500">
                No matching proposals.
                {!showAll && hiddenCount > 0 && (
                  <button type="button" className="ml-1 text-[#770142] underline" onClick={() => setShowAll(true)}>
                    Show all ({hiddenCount} hidden)
                  </button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {rows.map(({ proposal: p, party, f, status, badgeRecord }) => {
                const sc = PROPOSAL_STATUS_CONFIG[status] || PROPOSAL_STATUS_CONFIG.draft;
                const searchable = [party.company, party.contact, party.email, p.client_name, p.company, sc.label].filter(Boolean).join(' ');
                const isSel = p.id === value;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${searchable} ${p.id}`}
                    onSelect={() => { onChange?.(p.id); setOpen(false); }}
                    className="flex items-start gap-2 py-2.5 cursor-pointer"
                  >
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isSel ? 'opacity-100 text-[#770142]' : 'opacity-0'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">{party.company}</span>
                        {party.contact && <span className="text-sm text-gray-500">{party.contact}</span>}
                        <DemoOrInternalBadge record={badgeRecord} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                        <span className="font-medium text-gray-700">{fmtMoney(p.total_amount)}</span>
                        <span>·</span>
                        <span>{fmtDate(p.created_date)}</span>
                        <Badge className={`${sc.color} text-[10px] px-1.5 py-0 h-4 font-semibold`}>{sc.label}</Badge>
                        {f.total > 0 && (
                          <span className={f.allBooked ? 'text-green-700' : 'text-amber-700'}>
                            {f.booked} of {f.total} booked{f.delivered > 0 ? ` · ${f.delivered} delivered` : ''}
                          </span>
                        )}
                        {f.total === 0 && <span className="italic text-gray-400">no bookable services</span>}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-gray-500 bg-gray-50">
            <span>{rows.length} shown{!showAll && hiddenCount > 0 ? ` · ${hiddenCount} hidden (drafts, declined, fulfilled, demo)` : ''}</span>
            <button type="button" className="text-[#770142] font-medium hover:underline" onClick={() => setShowAll(s => !s)}>
              {showAll ? 'Show open only' : 'Show all'}
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
