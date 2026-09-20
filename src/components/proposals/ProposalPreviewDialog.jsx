import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Pencil, ExternalLink, Link2, Send, Bell, FileText, Package, Receipt,
  Clock, Eye, CheckCircle2, XCircle, Trophy, Mail, ListChecks, Sparkles,
} from 'lucide-react';
import { PROPOSAL_STATUS_CONFIG } from '@/lib/statusConfig';
import { getProposalServiceItems, getProposalParty, SELECTION_GROUPS } from '@/lib/proposalFulfillment';
import { BOX_DISPLAY_NAMES, WELLNESS_BOX_PRICES, applyBoxFloor } from '@/lib/wellnessBoxes';
import { copyToClipboard } from '@/lib/copyToClipboard';
import ProposalFulfillment from '@/components/proposals/ProposalFulfillment';
import { RecordDetailContent, RecordDetailFrame, RailSection, FrameSection } from '@/components/shared/RecordDetailFrame';

const GROUP_TITLES = { workshop: 'Workshops', challenge: 'Challenges', leadership: 'Leadership', class: 'Classes' };
// Delivery is only meaningful once the proposal is out the door.
const DELIVERY_STATUSES = ['sent', 'viewed', 'accepted', 'fulfilled'];

const money = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtDateTime = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fmtDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * One proposal preview for the whole app — replaces the two separate
 * "Proposal Details" popups (Proposals page and the client popup's
 * Commercial tab), which each showed a different half of the record.
 *
 * Layout (RecordDetailFrame): header = party, status, total; main = program
 * overview, what's included (services resolved the same way the fulfillment
 * card does, boxes, custom charges), delivery progress; rail = activity
 * timeline and actions.
 *
 * Optional callbacks add the Proposals page's workflow buttons; the dialog
 * closes itself before handing off so the next dialog opens cleanly.
 */
export default function ProposalPreviewDialog({ proposal, open, onOpenChange, client = null, onSend, onRemind, onQuickBooks }) {
  const { data: services = [] } = useQuery({
    queryKey: ['delivery-services'],
    queryFn: () => base44.entities.Service.list('sort_order', 200),
    enabled: !!proposal?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (!proposal) return null;

  const status = proposal.status || 'draft';
  const statusCfg = PROPOSAL_STATUS_CONFIG[status] || PROPOSAL_STATUS_CONFIG.draft;
  const party = getProposalParty(proposal, client ? [client] : []);
  const sel = proposal.selections || {};

  // ── What's included ──
  const items = getProposalServiceItems(proposal, services);
  const grouped = SELECTION_GROUPS
    .map(g => ({ category: g.category, title: GROUP_TITLES[g.category] || g.label, items: items.filter(i => i.category === g.category) }))
    .filter(g => g.items.length > 0);
  const boxQuantities = sel.sampleBoxQuantities || sel.wellnessBoxes || {};
  const boxes = Object.entries(boxQuantities)
    .filter(([, q]) => Number(q) > 0)
    .map(([key, q]) => {
      const unit = applyBoxFloor(key, (sel.sampleBoxPrices?.[key] ?? WELLNESS_BOX_PRICES[key]) || 0);
      return { key, name: BOX_DISPLAY_NAMES[key] || key, qty: Number(q), unit };
    });
  const customCharges = (Array.isArray(sel.customCharges) ? sel.customCharges : []).filter(c => c && (c.label || c.amount));
  const nothingIncluded = grouped.length === 0 && boxes.length === 0 && customCharges.length === 0;

  // ── Activity timeline (only the events that happened) ──
  const activity = [
    { icon: Clock, label: 'Created', when: fmtDate(proposal.created_date), tone: 'text-gray-500' },
    proposal.sent_date && { icon: Send, label: `Sent${proposal.client_email ? ` to ${proposal.client_email}` : ''}`, when: fmtDateTime(proposal.sent_date), tone: 'text-blue-600' },
    proposal.viewed_date && { icon: Eye, label: 'Viewed by client', when: fmtDateTime(proposal.viewed_date), tone: 'text-purple-600' },
    proposal.reminder_count > 0 && { icon: Bell, label: `${proposal.reminder_count} reminder${proposal.reminder_count === 1 ? '' : 's'} sent`, when: proposal.last_reminder_date ? `last ${fmtDate(proposal.last_reminder_date)}` : null, tone: 'text-amber-600' },
    proposal.accepted_date && { icon: CheckCircle2, label: 'Accepted', when: fmtDate(proposal.accepted_date), tone: 'text-green-600' },
    proposal.declined_date && { icon: XCircle, label: 'Declined', when: fmtDate(proposal.declined_date), tone: 'text-red-600' },
    proposal.fulfilled_date && { icon: Trophy, label: 'Fulfilled', when: fmtDate(proposal.fulfilled_date), tone: 'text-emerald-600' },
    proposal.quickbooks_invoice_id && { icon: Receipt, label: `QuickBooks invoice${proposal.quickbooks_doc_number ? ` #${proposal.quickbooks_doc_number}` : ''}`, when: null, tone: 'text-[#013f7c]' },
  ].filter(Boolean);

  const clientViewUrl = `${window.location.origin}/ViewProposal?id=${proposal.id}`;
  const handOff = (fn) => () => { onOpenChange?.(false); fn(proposal); };
  const copyClientLink = async () => {
    const ok = await copyToClipboard(clientViewUrl);
    if (ok) toast.success('Client link copied'); else toast.error('Could not copy — please copy manually');
  };

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <DialogTitle className="text-xl font-bold text-[#013f7c] truncate">{party.company}</DialogTitle>
          <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
          {proposal.is_demo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
        </div>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          Proposal{party.contact ? ` for ${party.contact}` : ''}{party.email ? ` · ${party.email}` : ''}
          {proposal.matched_stage ? ` · ${proposal.matched_stage}` : ''}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">Total</p>
        <p className="text-2xl font-bold leading-tight tabular-nums" style={{ color: '#770142' }}>{money(proposal.total_amount)}</p>
      </div>
    </div>
  );

  const rail = (
    <>
      <RailSection title="Actions" icon={Sparkles}>
        <div className="grid gap-2">
          <Link to={createPageUrl('EditProposal') + `?id=${proposal.id}`} onClick={() => onOpenChange?.(false)}>
            <Button size="sm" className="w-full justify-start bg-[#770142] hover:bg-[#5a0132]">
              <Pencil className="w-4 h-4 mr-2" /> Edit proposal
            </Button>
          </Link>
          {status === 'draft' && onSend && (
            <Button size="sm" variant="outline" className="w-full justify-start text-[#770142] border-[#770142]" onClick={handOff(onSend)}>
              <Send className="w-4 h-4 mr-2" /> Send to client
            </Button>
          )}
          {(status === 'sent' || status === 'viewed') && onRemind && (
            <Button size="sm" variant="outline" className="w-full justify-start text-amber-700 border-amber-500" onClick={handOff(onRemind)}>
              <Bell className="w-4 h-4 mr-2" /> Send a reminder
            </Button>
          )}
          {status === 'accepted' && !proposal.quickbooks_invoice_id && onQuickBooks && (
            <Button size="sm" variant="outline" className="w-full justify-start text-[#013f7c] border-[#013f7c]" onClick={handOff(onQuickBooks)}>
              <Receipt className="w-4 h-4 mr-2" /> Send to QuickBooks…
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <a href={clientViewUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="w-full justify-start">
                <ExternalLink className="w-4 h-4 mr-1.5" /> Client view
              </Button>
            </a>
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={copyClientLink}>
              <Link2 className="w-4 h-4 mr-1.5" /> Copy link
            </Button>
          </div>
        </div>
      </RailSection>

      <RailSection title="Activity" icon={Clock}>
        <ol className="relative space-y-3 pl-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-gray-200">
          {activity.map((a, i) => {
            const Icon = a.icon;
            return (
              <li key={i} className="relative">
                <span className="absolute -left-5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
                  <Icon className={`w-2.5 h-2.5 ${a.tone}`} />
                </span>
                <p className="text-sm text-gray-800 leading-snug break-words">{a.label}</p>
                {a.when && <p className="text-[11px] text-gray-400">{a.when}</p>}
              </li>
            );
          })}
        </ol>
        {!proposal.sent_date && status === 'draft' && (
          <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1"><Mail className="w-3 h-3" /> Not sent yet.</p>
        )}
      </RailSection>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RecordDetailContent maxWidth="1100px" fill={false}>
        <RecordDetailFrame header={header} rail={rail}>
          <div className="space-y-6">
            {proposal.narrative_summary && (
              <FrameSection title="Program overview" icon={FileText}>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line rounded-lg bg-gray-50 border border-gray-100 p-3.5">
                  {proposal.narrative_summary}
                </p>
              </FrameSection>
            )}

            <FrameSection title="What's included" icon={ListChecks}>
              {nothingIncluded && (
                <p className="text-sm text-gray-400 text-center py-6 border border-dashed rounded-lg">No services or boxes on this proposal yet.</p>
              )}
              {grouped.map(g => (
                <div key={g.category} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.title} ({g.items.length})</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {g.items.map(item => (
                      <div key={item.key} className="rounded-lg border border-gray-200 bg-white p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 leading-snug">
                            {item.name}
                            {item.rawId && <span className="ml-1.5 text-[10px] text-amber-600 font-normal">(not in catalog)</span>}
                          </p>
                          {item.price > 0 && <span className="text-xs font-semibold text-gray-600 tabular-nums shrink-0">{money(item.price)}</span>}
                        </div>
                        {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {boxes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1"><Package className="w-3 h-3" /> Wellness boxes</p>
                  <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
                    {boxes.map(b => (
                      <div key={b.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="text-gray-800 min-w-0 truncate">{b.name}</span>
                        <span className="text-gray-500 tabular-nums shrink-0">{b.qty} × {money(b.unit)} = <span className="font-semibold text-gray-700">{money(b.qty * b.unit)}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {customCharges.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Custom charges</p>
                  <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
                    {customCharges.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="text-gray-800 min-w-0 truncate">{c.label || 'Custom charge'}</span>
                        <span className="font-semibold text-gray-700 tabular-nums shrink-0">{money(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </FrameSection>

            {DELIVERY_STATUSES.includes(status) && (
              <FrameSection title="Delivery" icon={CheckCircle2}>
                <ProposalFulfillment proposal={proposal} />
              </FrameSection>
            )}
          </div>
        </RecordDetailFrame>
      </RecordDetailContent>
    </Dialog>
  );
}
