import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RecordDetailContent, RecordDetailFrame, RailSection, StatTile, FrameSection } from '@/components/shared/RecordDetailFrame';
import { Sparkles, Plus, X, Loader2, ChevronDown, ChevronRight, PenLine } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Writing style — what Maya has learned from how William / Heather edit her campaign
 * drafts (WritingStyleProfile + learnWritingStyle, 2026-10-15). Everything here is editable:
 * the learned rules, the sender's own always-on rules, and the on/off switch. Recent
 * comparisons show Maya's draft next to what actually went out.
 */

const SENDERS = [
  { key: 'william', label: 'William' },
  { key: 'heather', label: 'Heather' },
];

// Same rule as base44/shared/writingStyle.ts senderForRecipient: the mailbox it went out from wins.
function senderOf(r, campaignById) {
  const mb = String(r.draft_mailbox || '').toLowerCase();
  if (mb.startsWith('heather@')) return 'heather';
  if (mb.startsWith('william@')) return 'william';
  const c = campaignById[r.campaign_id];
  if (c?.sender_mode === 'heather') return 'heather';
  if (c?.sender_mode === 'william') return 'william';
  return String(r.owner || '').split(',')[0].trim().toLowerCase() === 'heather' ? 'heather' : 'william';
}

// Word-level diff for the side-by-side view.
function diffWords(before, after) {
  const a = String(before || '').split(/(\s+)/).slice(0, 900);
  const b = String(after || '').split(/(\s+)/).slice(0, 900);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left = [], right = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { left.push({ t: a[i] }); right.push({ t: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { left.push({ t: a[i], del: true }); i++; }
    else { right.push({ t: b[j], add: true }); j++; }
  }
  while (i < n) left.push({ t: a[i++], del: true });
  while (j < m) right.push({ t: b[j++], add: true });
  return { left, right };
}

function DiffText({ parts, kind }) {
  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) => {
        if (kind === 'left' && p.del && p.t.trim()) return <span key={i} className="bg-red-100 text-red-800 line-through decoration-red-400/70 rounded-sm">{p.t}</span>;
        if (kind === 'right' && p.add && p.t.trim()) return <span key={i} className="bg-emerald-100 text-emerald-900 rounded-sm">{p.t}</span>;
        return <span key={i}>{p.t}</span>;
      })}
    </p>
  );
}

function ComparisonRow({ r }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((r.edit_ratio || 0) * 100);
  const before = r.maya_body || r.draft_body || '';
  const diff = useMemo(() => (open ? diffWords(before, r.final_body) : null), [open, before, r.final_body]);
  return (
    <div className="border rounded-lg bg-white">
      <button className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 rounded-lg" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <span className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">
          {r.name || r.email}
          {r.company && <span className="font-normal text-gray-400"> · {r.company}</span>}
        </span>
        <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
          {r.sent_at ? new Date(r.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
        </span>
        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${pct < 3 ? 'bg-gray-100 text-gray-500' : pct < 25 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
          {pct < 3 ? 'sent as drafted' : `${pct}% changed`}
        </span>
      </button>
      {open && diff && (
        <div className="grid gap-3 md:grid-cols-2 px-3 pb-3 pt-1 border-t">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Maya's draft</p>
            <DiffText parts={diff.left} kind="left" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
              What went out {r.final_source === 'approved' ? '(approved in the app)' : '(from Gmail Sent)'}
            </p>
            <DiffText parts={diff.right} kind="right" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function WritingStylePanel({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [sender, setSender] = useState('william');
  const [rules, setRules] = useState([]);
  const [ownRules, setOwnRules] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [learning, setLearning] = useState(false);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['writing_style_profiles'],
    queryFn: () => base44.entities.WritingStyleProfile.list('-updated_date', 10),
    enabled: open,
  });
  const profile = profiles.find(p => p.sender === sender) || null;

  const { data: sentRows = [] } = useQuery({
    queryKey: ['writing_style_recipients'],
    queryFn: async () => {
      const [sent, replied, campaigns] = await Promise.all([
        base44.entities.CampaignRecipient.filter({ status: 'sent' }, '-sent_at', 300),
        base44.entities.CampaignRecipient.filter({ status: 'replied' }, '-sent_at', 300),
        base44.entities.OutreachCampaign.list('-created_date', 300),
      ]);
      const byId = Object.fromEntries(campaigns.map(c => [c.id, c]));
      return [...sent, ...replied].map(r => ({ ...r, _sender: senderOf(r, byId) }));
    },
    enabled: open,
  });

  const mine = sentRows.filter(r => r._sender === sender);
  const compared = mine
    .filter(r => r.final_body && (r.maya_body || r.draft_body))
    .sort((a, b) => new Date(b.sent_at || 0) - new Date(a.sent_at || 0));
  const waitingToLearn = mine.filter(r => r.style_status === 'pending').length;
  const notReadYet = mine.filter(r => !r.style_status && r.final_source !== 'gmail_sent').length;

  // Load the editable copy whenever the sender or the saved profile changes.
  useEffect(() => {
    setRules(profile?.learned_rules || []);
    setOwnRules(profile?.own_rules || '');
    setDirty(false);
  }, [sender, profile?.id, profile?.updated_date]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['writing_style_profiles'] });
    queryClient.invalidateQueries({ queryKey: ['writing_style_recipients'] });
  };

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const data = {
        learned_rules: rules.map(r => r.trim()).filter(Boolean),
        own_rules: ownRules,
        ...extra,
      };
      if (profile) await base44.entities.WritingStyleProfile.update(profile.id, data);
      else await base44.entities.WritingStyleProfile.create({ sender, is_active: true, ...data });
      setDirty(false);
      refresh();
      toast.success('Writing style saved');
    } catch (e) {
      toast.error('Could not save: ' + (e?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v) => {
    try {
      if (profile) await base44.entities.WritingStyleProfile.update(profile.id, { is_active: v });
      else await base44.entities.WritingStyleProfile.create({ sender, is_active: v, learned_rules: rules, own_rules: ownRules });
      refresh();
      toast.success(v ? 'New drafts will use this style' : 'Style paused — new drafts use the base voice only');
    } catch (e) {
      toast.error('Could not update: ' + (e?.message || 'unknown error'));
    }
  };

  const learnNow = async () => {
    if (dirty) await save();
    setLearning(true);
    try {
      let last = null;
      // Reading Gmail is batched (20 emails a call). A few rounds here; the nightly run
      // finishes the rest of a large backlog.
      for (let round = 0; round < 4; round++) {
        const res = await base44.functions.invoke('learnWritingStyle', { sender });
        last = res?.data;
        if (last?.error) throw new Error(last.error);
        const r = (last?.results || [])[0];
        if (!(last?.still_to_read > 0) && !(r?.remaining > 0)) break;
      }
      refresh();
      const r = (last?.results || [])[0];
      if (r?.error) toast.error(r.error);
      else if (r?.summary) toast.success(r.summary, { duration: 9000 });
      else toast.success('Up to date — no new edits to learn from');
      if (last?.notes?.length) toast.message(last.notes.join(' '));
    } catch (e) {
      toast.error('Learning failed: ' + (e?.message || 'unknown error'));
    } finally {
      setLearning(false);
    }
  };

  const name = SENDERS.find(s => s.key === sender)?.label;
  const isActive = profile ? profile.is_active !== false : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RecordDetailContent maxWidth="1180px">
        <RecordDetailFrame
          header={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <PenLine className="w-5 h-5 text-[#264d44] shrink-0" />
                <DialogTitle className="text-lg">Writing style</DialogTitle>
              </div>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {SENDERS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSender(s.key)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${sender === s.key ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 basis-full">
                Maya compares her campaign drafts with what {name} actually sent, and writes new drafts the way {name} edits them.
              </p>
            </div>
          }
          rail={
            <>
              <RailSection title="Use in new drafts">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-600">{isActive ? `On — new ${name} drafts follow this style` : 'Paused — drafts use the base voice only'}</p>
                  <Switch checked={isActive} onCheckedChange={toggleActive} />
                </div>
              </RailSection>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Edits learned" value={profile?.edits_analyzed || 0} color="#264d44" />
                <StatTile label="Sent as drafted" value={profile?.unchanged_count || 0} color="#013f7c" />
                <StatTile label="Waiting to learn" value={waitingToLearn} color="#b45309" />
                <StatTile label="Not read yet" value={notReadYet} color="#6b7280" sub="sent emails" />
              </div>
              <Button onClick={learnNow} disabled={learning} className="w-full bg-[#264d44] hover:bg-[#264d44]/90 text-white gap-2">
                {learning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {learning ? 'Reading sent emails…' : 'Learn from my edits now'}
              </Button>
              <p className="text-[11px] text-gray-400 leading-snug">Also runs every night. Gmail is only read, never changed — nothing is sent.</p>
              {profile?.last_summary && (
                <RailSection title="Last update">
                  <p className="text-sm text-gray-700">{profile.last_summary}</p>
                  {profile.last_learned_at && (
                    <p className="text-[11px] text-gray-400 mt-1">{new Date(profile.last_learned_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  )}
                </RailSection>
              )}
            </>
          }
          railFirstOnNarrow={false}
          footer={
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">{dirty ? 'Unsaved changes' : ''}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                <Button onClick={() => save()} disabled={!dirty || saving} className="bg-[#264d44] hover:bg-[#264d44]/90 text-white">
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          }
        >
          {profilesLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="space-y-7">
              <FrameSection title={`Learned from ${name}'s edits`} icon={Sparkles}
                action={<Button size="sm" variant="ghost" className="gap-1 h-7" onClick={() => { setRules(r => [...r, '']); setDirty(true); }}><Plus className="w-3.5 h-3.5" /> Add rule</Button>}>
                {rules.length === 0 ? (
                  <div className="text-sm text-gray-400 border border-dashed rounded-lg p-4 text-center">
                    Nothing learned yet. Click <span className="font-medium text-gray-600">Learn from my edits now</span> — Maya will read {name}'s sent campaign emails and compare them with her drafts.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {rules.map((rule, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 w-5 text-right pt-2.5 shrink-0">{i + 1}.</span>
                        <Textarea
                          rows={1}
                          value={rule}
                          onChange={e => { const v = e.target.value; setRules(rs => rs.map((x, k) => (k === i ? v : x))); setDirty(true); }}
                          className="min-h-[38px] text-sm resize-y"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-600 shrink-0 mt-0.5" title="Remove rule"
                          onClick={() => { setRules(rs => rs.filter((_, k) => k !== i)); setDirty(true); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400">Edit or remove anything that isn't right. The next learning run starts from your edited list.</p>
              </FrameSection>

              <FrameSection title={`${name}'s own rules — always followed`}>
                <Textarea
                  rows={4}
                  value={ownRules}
                  onChange={e => { setOwnRules(e.target.value); setDirty(true); }}
                  placeholder={'One per line, e.g.\nNever open with "I hope this finds you well"\nKeep it under 80 words'}
                  className="text-sm"
                />
                <p className="text-xs text-gray-400">These win over everything else, and the learner never changes them.</p>
              </FrameSection>

              {(profile?.examples || []).length > 0 && (
                <FrameSection title="How you rewrite Maya">
                  <div className="grid gap-3 lg:grid-cols-2">
                    {profile.examples.map((ex, i) => (
                      <div key={i} className="border rounded-lg p-3 bg-white space-y-2 min-w-0">
                        <p className="text-sm text-gray-500 line-through decoration-red-300">{ex.before}</p>
                        <p className="text-sm text-gray-900">{ex.after}</p>
                        {ex.why && <p className="text-xs text-gray-400 italic">{ex.why}</p>}
                      </div>
                    ))}
                  </div>
                </FrameSection>
              )}

              <FrameSection title={`Recent comparisons (${compared.length})`}>
                {compared.length === 0 ? (
                  <p className="text-sm text-gray-400">No sent emails compared yet for {name}.</p>
                ) : (
                  <div className="space-y-1.5">
                    {compared.slice(0, 40).map(r => <ComparisonRow key={r.id} r={r} />)}
                  </div>
                )}
              </FrameSection>
            </div>
          )}
        </RecordDetailFrame>
      </RecordDetailContent>
    </Dialog>
  );
}
