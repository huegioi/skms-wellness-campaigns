import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Phone, MessageSquare, Linkedin, Video, StickyNote, Plus, Loader2, X } from 'lucide-react';

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'meeting', label: 'Meeting', icon: Video },
];

const CHANNEL_ICONS = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
  meeting: Video,
  other: StickyNote,
};

// Map touch channel → Lead.outreach_channel enum values
const CHANNEL_TO_OUTREACH = {
  email: 'email',
  linkedin: 'linkedin',
  call: 'phone',
  text: 'other',
  meeting: 'other',
};

function relDate(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function InteractionTimeline({ lead_id, client_id, referral_partner_id, onUpdate }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [channel, setChannel] = useState('email');
  const [note, setNote] = useState('');
  const [isContact, setIsContact] = useState(true);

  const scopeKey = lead_id
    ? ['interactions', 'lead', lead_id]
    : client_id
      ? ['interactions', 'client', client_id]
      : ['interactions', 'partner', referral_partner_id];

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: scopeKey,
    queryFn: () => {
      const f = lead_id
        ? { lead_id }
        : client_id
          ? { client_id }
          : { referral_partner_id };
      return base44.entities.ClientInteraction.filter(f, '-date');
    },
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const typeMap = { email: 'email', call: 'call', meeting: 'meeting', text: 'note', linkedin: 'note' };
      const label = CHANNEL_OPTIONS.find(c => c.value === channel)?.label || 'Touch';
      await base44.entities.ClientInteraction.create({
        channel,
        interaction_type: isContact ? (typeMap[channel] || 'note') : 'note',
        subject: note.trim() || (isContact ? `${label} touch` : 'Note'),
        notes: note.trim() || undefined,
        date: now,
        lead_id: lead_id || undefined,
        client_id: client_id || undefined,
        referral_partner_id: referral_partner_id || undefined,
      });
      if (isContact) {
        const today = new Date().toISOString().slice(0, 10);
        if (lead_id) {
          await base44.entities.Lead.update(lead_id, {
            last_contacted_date: today,
            outreach_channel: CHANNEL_TO_OUTREACH[channel] || 'other',
          });
        } else if (client_id) {
          await base44.entities.Client.update(client_id, { last_contacted_date: today });
        } else if (referral_partner_id) {
          await base44.entities.ReferralPartner.update(referral_partner_id, { last_contacted_date: today });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scopeKey });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      setNote('');
      setChannel('email');
      setIsContact(true);
      setShowForm(false);
      if (onUpdate) onUpdate();
    },
  });

  const saveDisabled = logMutation.isPending || (!isContact && !note.trim());

  return (
    <div className="space-y-3">
      {showForm ? (
        <div className="bg-gray-50 border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Log a touch</span>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = channel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-navy'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {opt.label}
                </button>
              );
            })}
          </div>
          <Textarea
            placeholder="Note (optional)..."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="bg-white"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <Checkbox checked={isContact} onCheckedChange={v => setIsContact(v === true)} />
            This was a contact (updates last contacted date)
          </label>
          <Button
            size="sm"
            className="bg-brand-green hover:bg-brand-forest gap-1.5"
            disabled={saveDisabled}
            onClick={() => logMutation.mutate()}
          >
            {logMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Log touch
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-6">Loading...</p>
      ) : interactions.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">No activity logged yet.</p>
      ) : (
        <div className="space-y-2">
          {interactions.map(it => {
            const Icon = CHANNEL_ICONS[it.channel] || StickyNote;
            return (
              <div key={it.id} className="flex gap-3 bg-white border rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{it.subject || it.interaction_type}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{relDate(it.date)}</span>
                  </div>
                  {it.notes && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{it.notes}</p>}
                  {it.outcome && <p className="text-xs text-green-600 mt-1">→ {it.outcome}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}