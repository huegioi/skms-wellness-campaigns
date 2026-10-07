import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MEETING_OUTCOMES, stageLabel } from '@/lib/leadStages';

/**
 * Asks for the few details a stage needs, right after a lead lands in it:
 *   met            → meeting outcome + agreed next step + next follow-up date
 *   not_interested → reason + revisit date
 *   not_a_fit      → reason
 * Skipping is allowed — Maya will ask again (meeting_outcome_needed) for "met".
 */
export default function StageDetailsDialog({ target, onClose, onSaved }) {
  const lead = target?.lead;
  const stage = target?.stage;
  const [outcome, setOutcome] = useState('held');
  const [nextStep, setNextStep] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [reason, setReason] = useState('');
  const [revisit, setRevisit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setOutcome(lead.meeting_outcome || 'held');
    setNextStep(lead.next_step || '');
    setNextDate(target?.patch?.next_followup_date || lead.next_followup_date || '');
    setReason(lead.closed_reason || '');
    setRevisit(target?.patch?.revisit_date || lead.revisit_date || '');
  }, [lead, target]);

  if (!lead) return null;

  const save = async () => {
    setSaving(true);
    const data = {};
    if (stage === 'met') {
      data.meeting_outcome = outcome;
      data.next_step = nextStep.trim();
      if (nextDate) data.next_followup_date = nextDate;
    } else {
      data.closed_reason = reason.trim();
      if (stage === 'not_interested' && revisit) {
        data.revisit_date = revisit;
        data.next_followup_date = revisit;
      }
    }
    try {
      await base44.entities.Lead.update(lead.id, data);
      onSaved?.(lead.id, data);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader>
          <DialogTitle>{lead.name} → {stageLabel(stage)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          {stage === 'met' ? (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">How did the meeting go?</label>
                <div className="flex gap-1.5">
                  {MEETING_OUTCOMES.map(o => (
                    <button key={o.key} type="button" onClick={() => setOutcome(o.key)}
                      className={`flex-1 text-sm px-2 py-1.5 rounded-lg border ${outcome === o.key ? 'bg-[#013f7c] text-white border-[#013f7c]' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Agreed next step</label>
                <Textarea rows={2} placeholder="e.g. Send partner agreement; intro to their HR client" value={nextStep} onChange={e => setNextStep(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Follow up on</label>
                <Input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Why?</label>
                <Textarea rows={2} placeholder={stage === 'not_a_fit' ? 'e.g. P&C only, no group benefits book' : 'e.g. Busy with renewals until Q1'} value={reason} onChange={e => setReason(e.target.value)} autoFocus />
              </div>
              {stage === 'not_interested' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Revisit on</label>
                  <Input type="date" value={revisit} onChange={e => setRevisit(e.target.value)} />
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 pt-1">
            <Button className="flex-1 bg-[#013f7c] hover:bg-[#012d5a]" onClick={save} disabled={saving}>Save</Button>
            <Button variant="outline" onClick={onClose}>Skip</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
