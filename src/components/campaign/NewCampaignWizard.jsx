import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import WizardStepAudience from '@/components/campaign/wizard/WizardStepAudience';
import WizardStepMessage from '@/components/campaign/wizard/WizardStepMessage';
import WizardStepSettings from '@/components/campaign/wizard/WizardStepSettings';

const INITIAL_FORM = {
  name: '',
  audience_type: 'client',
  tag_ids: [],
  subject_template: '',
  body_template: '',
  personalization_notes: '',
  sender_mode: 'record_owner',
  cc_emails: [],
  template_source_id: '',
};

export default function NewCampaignWizard({ open, onOpenChange, onCreated }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [excludedIds, setExcludedIds] = useState([]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({ ...INITIAL_FORM });
      setExcludedIds([]);
    }
  }, [open]);

  const updateForm = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleExclude = (id) => {
    setExcludedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const canProceed = () => {
    if (step === 1) return form.name.trim() !== '' && form.tag_ids.length > 0;
    if (step === 2) return form.subject_template.trim() !== '' && form.body_template.trim() !== '';
    return true;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const campaign = await base44.entities.OutreachCampaign.create({
        name: form.name,
        audience_type: form.audience_type,
        tag_ids: form.tag_ids,
        subject_template: form.subject_template,
        body_template: form.body_template,
        personalization_notes: form.personalization_notes,
        sender_mode: form.sender_mode,
        cc_emails: form.cc_emails,
        ...(form.template_source_id ? { template_source_id: form.template_source_id } : {}),
        status: 'draft',
      });

      const res = await base44.functions.invoke('buildCampaignAudience', {
        campaign_id: campaign.id,
        excluded_record_ids: excludedIds,
      });

      return { campaign, audienceResult: res.data };
    },
    onSuccess: ({ campaign, audienceResult }) => {
      queryClient.invalidateQueries({ queryKey: ['outreach_campaigns'] });
      toast.success(`Campaign created - ${audienceResult.created} recipients, ${audienceResult.skipped} skipped`);
      onCreated(campaign.id);
    },
    onError: (e) => {
      toast.error(e?.data?.error || e?.message || 'Failed to create campaign');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Outreach Campaign</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-1">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${s === step ? 'w-8 bg-[#264d44]' : s < step ? 'w-4 bg-[#264d44]/40' : 'w-4 bg-gray-200'}`}
            />
          ))}
          <span className="text-xs text-gray-500 ml-1">Step {step} of 3</span>
        </div>

        {step === 1 && (
          <WizardStepAudience
            form={form}
            updateForm={updateForm}
            excludedIds={excludedIds}
            toggleExclude={toggleExclude}
          />
        )}
        {step === 2 && (
          <WizardStepMessage form={form} updateForm={updateForm} />
        )}
        {step === 3 && (
          <WizardStepSettings form={form} updateForm={updateForm} />
        )}

        <div className="flex justify-between pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            {step < 3 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="bg-[#264d44] hover:bg-[#264d44]/90 text-white"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="bg-[#264d44] hover:bg-[#264d44]/90 text-white"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}