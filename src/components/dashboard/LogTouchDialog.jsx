import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Phone, MessageSquare, Linkedin, Video, Loader2 } from 'lucide-react';

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'meeting', label: 'Meeting', icon: Video },
];

const CHANNEL_TO_OUTREACH = {
  email: 'email',
  linkedin: 'linkedin',
  call: 'phone',
  text: 'other',
  meeting: 'other',
};

/**
 * Quick touch-logging dialog. Creates a ClientInteraction and updates the
 * linked entity's last_contacted_date when "count as contact" is checked.
 */
export default function LogTouchDialog({ open, onClose, leadId, clientId, partnerId, entityName }) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState('email');
  const [note, setNote] = useState('');
  const [isContact, setIsContact] = useState(true);

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
        lead_id: leadId || undefined,
        client_id: clientId || undefined,
        referral_partner_id: partnerId || undefined,
      });
      if (isContact) {
        const today = new Date().toISOString().slice(0, 10);
        if (leadId) {
          await base44.entities.Lead.update(leadId, {
            last_contacted_date: today,
            outreach_channel: CHANNEL_TO_OUTREACH[channel] || 'other',
          });
        } else if (clientId) {
          await base44.entities.Client.update(clientId, { last_contacted_date: today });
        } else if (partnerId) {
          await base44.entities.ReferralPartner.update(partnerId, { last_contacted_date: today });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      setNote('');
      setChannel('email');
      setIsContact(true);
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader>
          <DialogTitle>Log Touch — {entityName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = channel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    active ? 'bg-[#264d44] text-white border-[#264d44]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <Textarea
            placeholder="Notes (optional for contact touches)..."
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Checkbox id="is_contact_touch" checked={isContact} onCheckedChange={setIsContact} />
            <label htmlFor="is_contact_touch" className="text-sm text-gray-700">Count as contact touch</label>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-[#264d44] hover:bg-[#1a3830]"
              disabled={logMutation.isPending || (!isContact && !note.trim())}
              onClick={() => logMutation.mutate()}
            >
              {logMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Log Touch
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}