import React, { useState, useEffect, useCallback } from 'react';
import {
  BellRing, Flag, CheckCircle2, Circle, Users, ChevronDown, ChevronRight, ExternalLink,
  Clock, ClipboardList, Wand2, Loader2, CalendarCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { renderInline } from '@/lib/renderInline';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { buildStageChange } from '@/lib/leadStages';

const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const VIEW_KEY = 'maya_followups_view';

/**
 * Maya's follow-up list.
 *  - Mine / All switch (Mine = items owned by you, plus items with no owner)
 *  - Grouped items expand to their leads; event groups can become a follow-up campaign in one click
 *  - Meeting-outcome items log Held / No-show / Rescheduled right here
 *  - Meeting-prep items open a one-page prep brief
 *  - Any item can be snoozed (1 day / 3 days / 1 week)
 */
export default function FollowUpsSection({ currentUser, refreshKey }) {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set());
  const [openGroups, setOpenGroups] = useState(new Set());
  const [groupLeads, setGroupLeads] = useState({});
  const [view, setView] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || 'mine'; } catch { return 'mine'; } });
  const [outcomeFor, setOutcomeFor] = useState(null);   // reminder id showing the "next step" input
  const [nextStep, setNextStep] = useState('');
  const [prep, setPrep] = useState(null);               // { reminder, text, loading }
  const [busyId, setBusyId] = useState(null);

  const firstName = currentUser?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'User';

  const loadReminders = useCallback(async () => {
    try {
      const raw = await base44.entities.MayaReminder.filter({ status: 'open' }, 'trigger_date', 300);
      const today = ymd(new Date());
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const sorted = raw
        .filter(r => !r.snoozed_until || r.snoozed_until <= today)
        .map(r => {
          const t = new Date(r.trigger_date); t.setHours(0, 0, 0, 0);
          const overdueDays = Math.round((todayStart - t) / 86400000);
          const info = ['meeting_prep', 'event_recap', 'weekly_pipeline'].includes(r.reminder_type);
          return { ...r, overdueDays, overdue: !info && overdueDays >= 3, info };
        })
        .sort((a, b) => {
          // Today's meeting prep first, then overdue, then by date
          if ((a.reminder_type === 'meeting_prep') !== (b.reminder_type === 'meeting_prep')) return a.reminder_type === 'meeting_prep' ? -1 : 1;
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          return new Date(a.trigger_date) - new Date(b.trigger_date);
        });
      setReminders(sorted);
    } catch (e) {
      console.log('[FollowUpsSection] Failed to load reminders:', e.message);
    }
  }, []);

  useEffect(() => { loadReminders(); }, [loadReminders, refreshKey]);

  const setViewSaved = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const complete = async (id) => {
    setDoneIds(prev => new Set([...prev, id]));
    try {
      await base44.entities.MayaReminder.update(id, { status: 'done', completed_by: firstName, completed_at: new Date().toISOString() });
    } catch (e) {
      console.log('[FollowUpsSection] Failed to complete reminder:', id, e.message);
    }
  };

  const snooze = async (r, days) => {
    setReminders(prev => prev.filter(x => x.id !== r.id));
    try {
      await base44.entities.MayaReminder.update(r.id, { snoozed_until: addDays(days) });
      toast.success(`Snoozed until ${new Date(addDays(days) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
    } catch (e) {
      toast.error('Could not snooze: ' + e.message);
      loadReminders();
    }
  };

  const toggleGroup = async (r) => {
    setOpenGroups(prev => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; });
    if (groupLeads[r.id] || !(r.lead_ids || []).length) return;
    try {
      const rows = await base44.entities.Lead.filter({ id: { $in: r.lead_ids } }, 'name', 200);
      setGroupLeads(prev => ({ ...prev, [r.id]: rows }));
    } catch (e) {
      console.log('[FollowUpsSection] Failed to load group:', e.message);
    }
  };

  // Meeting outcome, logged straight from the brief
  const logOutcome = async (r, outcome) => {
    if (!r.lead_id) return;
    setBusyId(r.id);
    try {
      let patch = { meeting_outcome: outcome };
      if (outcome === 'held' && nextStep.trim()) patch.next_step = nextStep.trim();
      if (outcome !== 'held') {
        // Didn't happen: back to Talking, follow up tomorrow to rebook
        const [lead] = await base44.entities.Lead.filter({ id: r.lead_id });
        if (lead) patch = { ...patch, ...buildStageChange(lead, 'in_conversation', { by: firstName, reason: outcome === 'no_show' ? 'No-show' : 'Rescheduled' }) };
        patch.next_followup_date = addDays(1);
      }
      await base44.entities.Lead.update(r.lead_id, patch);
      await complete(r.id);
      setOutcomeFor(null); setNextStep('');
      toast.success(outcome === 'held' ? 'Meeting outcome saved' : 'Saved — follow-up set for tomorrow');
    } catch (e) {
      toast.error('Could not save: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openPrep = async (r) => {
    setPrep({ reminder: r, text: '', loading: true });
    try {
      const res = await base44.functions.invoke('mayaMeetingPrep', { lead_id: r.lead_id, event_id: r.source_event_id || undefined });
      setPrep({ reminder: r, text: res.data?.prep || 'No prep available.', loading: false });
    } catch (e) {
      setPrep({ reminder: r, text: 'Could not build the prep brief: ' + e.message, loading: false });
    }
  };

  // One click: a follow-up campaign for this event group (drafts only — nothing is sent)
  const draftGroupFollowUps = async (r) => {
    const tag = r.group_key;
    if (!tag || tag.startsWith('__')) return;
    setBusyId(r.id);
    try {
      const tagged = (await base44.entities.Lead.filter({ is_archived: { $ne: true } }, '-created_date', 1000))
        .filter(l => (l.tags || []).includes(tag));
      const inGroup = new Set(r.lead_ids || []);
      const excluded = tagged.filter(l => !inGroup.has(l.id)).map(l => l.id);
      const label = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const campaign = await base44.entities.OutreachCampaign.create({
        name: `${tag} follow-up — ${label}`,
        description: `Follow-up with ${tag} contacts who have not started a conversation yet (from Maya's brief).`,
        audience_type: 'lead',
        audience_scope: 'tags',
        tag_ids: [tag],
        exclude_tag_ids: [],
        owner_filter: 'all',
        sender_mode: 'record_owner',
        subject_template: `Following up from ${tag}`,
        body_template: `Hi {{first_name}},\n\n[PERSONALIZE: pick up from where we met at ${tag} and anything they told us or we sent them since]\n\nI would love to find 20 minutes to talk about how we could help your clients with burnout and retention. Happy to work around your schedule.\n\nBest,`,
        personalization_notes: `People we met at ${tag} who haven't replied yet. Some already got one or two emails from us — don't repeat those; give one new, specific reason to talk, drawn from what we know about them.`,
        selected_ctas: [],
        status: 'draft',
      });
      await base44.functions.invoke('buildCampaignAudience', { campaign_id: campaign.id, excluded_record_ids: excluded });
      await complete(r.id);
      toast.success('Campaign created — generate the drafts when ready');
      navigate(`${createPageUrl('CampaignCalendar')}?tab=outreach&campaign=${campaign.id}`);
    } catch (e) {
      toast.error('Could not create the campaign: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const mine = (r) => !r.owner || r.owner.toLowerCase().includes(firstName.toLowerCase());
  const visible = view === 'mine' ? reminders.filter(mine) : reminders;
  if (reminders.length === 0) return null;
  const overdueCount = visible.filter(r => r.overdue && !doneIds.has(r.id)).length;

  return (
    <div className="pt-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <BellRing className="w-3.5 h-3.5 text-amber-700" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-amber-700">Follow-Ups</h3>
        <span className="rounded-full bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 font-medium">{visible.length}</span>
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 font-medium">{overdueCount} overdue</span>
        )}
        <div className="ml-auto flex rounded-full border border-gray-200 overflow-hidden text-[11px]">
          {['mine', 'all'].map(v => (
            <button key={v} type="button" onClick={() => setViewSaved(v)}
              className={`px-2.5 py-0.5 ${view === v ? 'bg-[#013f7c] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {v === 'mine' ? 'Mine' : 'All'}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">Nothing for you right now — switch to All to see Heather's and William's together.</p>}
      <div className="space-y-0.5">
        {visible.map(r => {
          const isDone = doneIds.has(r.id);
          const isGroup = (r.lead_ids || []).length > 0 && !r.lead_id;
          const isOpen = openGroups.has(r.id);
          const leadLink = r.lead_id ? createPageUrl('Leads') + `?leadId=${r.lead_id}` : null;
          const realCohort = r.group_key && !r.group_key.startsWith('__');
          const groupLink = isGroup && realCohort ? createPageUrl('Leads') + `?tag=${encodeURIComponent(r.group_key)}` : null;
          const Icon = r.reminder_type === 'meeting_prep' ? ClipboardList
            : r.reminder_type === 'meeting_outcome_needed' ? CalendarCheck
            : isGroup ? Users : null;
          return (
            <div key={r.id} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors group ${
              isDone ? 'bg-green-50' : r.overdue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-gray-50'}`}>
              <button type="button" className="mt-0.5 flex-shrink-0" title="Mark done" onClick={() => !isDone && complete(r.id)}>
                {isDone ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm leading-snug ${isDone ? 'line-through text-gray-400' : 'text-gray-700'} ${isGroup ? 'cursor-pointer' : ''}`}
                  onClick={() => isGroup && toggleGroup(r)}>
                  {isGroup && (isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 inline-block mr-0.5 text-gray-400" style={{ verticalAlign: 'text-bottom' }} />
                    : <ChevronRight className="w-3.5 h-3.5 inline-block mr-0.5 text-gray-400" style={{ verticalAlign: 'text-bottom' }} />)}
                  {Icon && <Icon className="w-3.5 h-3.5 inline-block mr-1 text-blue-500" style={{ verticalAlign: 'text-bottom' }} />}
                  {r.overdue && !isDone && !isGroup && <Flag className="w-3.5 h-3.5 text-red-500 inline-block mr-1" style={{ verticalAlign: 'text-bottom' }} />}
                  {renderInline(r.text)}
                  {r.overdue && !isDone && (
                    <span className="ml-2 rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 font-medium">{r.overdueDays}d overdue</span>
                  )}
                  {isDone && <span className="ml-2 text-xs text-green-600 font-medium">✓ {firstName}</span>}
                </span>

                {!isDone && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {r.reminder_type === 'meeting_prep' && r.lead_id && (
                      <button type="button" className="text-[#013f7c] hover:underline font-medium" onClick={() => openPrep(r)}>Prep brief</button>
                    )}
                    {r.reminder_type === 'meeting_outcome_needed' && r.lead_id && outcomeFor !== r.id && (
                      <>
                        <span className="text-gray-400">How did it go?</span>
                        <button type="button" className="text-green-700 hover:underline font-medium" onClick={() => { setOutcomeFor(r.id); setNextStep(''); }}>Held</button>
                        <button type="button" className="text-red-700 hover:underline" disabled={busyId === r.id} onClick={() => logOutcome(r, 'no_show')}>No-show</button>
                        <button type="button" className="text-amber-700 hover:underline" disabled={busyId === r.id} onClick={() => logOutcome(r, 'rescheduled')}>Rescheduled</button>
                      </>
                    )}
                    {r.reminder_type === 'lead_group_follow_up' && realCohort && (
                      <button type="button" className="text-[#013f7c] hover:underline font-medium inline-flex items-center gap-1" disabled={busyId === r.id} onClick={() => draftGroupFollowUps(r)}>
                        {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Draft follow-ups
                      </button>
                    )}
                    {(leadLink || groupLink) && (
                      <Link to={leadLink || groupLink} className="text-[#013f7c] hover:underline inline-flex items-center gap-0.5">
                        {isGroup ? 'Open group' : 'Open'} <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="text-gray-400 hover:text-gray-600 inline-flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> Snooze
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => snooze(r, 1)}>Until tomorrow</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => snooze(r, 3)}>3 days</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => snooze(r, 7)}>1 week</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {outcomeFor === r.id && !isDone && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input className="h-7 text-xs" placeholder="Agreed next step (optional)" value={nextStep}
                      onChange={e => setNextStep(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') logOutcome(r, 'held'); }} />
                    <Button size="sm" className="h-7 text-xs bg-[#013f7c] hover:bg-[#012d5a]" disabled={busyId === r.id} onClick={() => logOutcome(r, 'held')}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOutcomeFor(null)}>Cancel</Button>
                  </div>
                )}

                {isGroup && isOpen && (
                  <ul className="mt-1.5 ml-1 space-y-0.5">
                    {(groupLeads[r.id] || []).map(l => (
                      <li key={l.id} className="text-xs text-gray-600">
                        <Link to={createPageUrl('Leads') + `?leadId=${l.id}`} className="hover:underline">
                          {l.name}{l.company ? ` · ${l.company}` : ''}
                        </Link>
                        {l.owner && <span className="text-gray-400"> · {l.owner}</span>}
                      </li>
                    ))}
                    {!groupLeads[r.id] && <li className="text-xs text-gray-400">Loading…</li>}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!prep} onOpenChange={(open) => !open && setPrep(null)}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Meeting prep</DialogTitle>
          </DialogHeader>
          {prep?.loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Maya is reading the history…</div>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{prep?.text}</pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
