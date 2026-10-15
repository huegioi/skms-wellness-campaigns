import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { RecordDetailContent, RecordDetailFrame } from '@/components/shared/RecordDetailFrame';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import WizardStepAudience from '@/components/campaign/wizard/WizardStepAudience';
import WizardStepMessage from '@/components/campaign/wizard/WizardStepMessage';
import WizardStepSettings from '@/components/campaign/wizard/WizardStepSettings';

const STEP_LABELS = ['Audience', 'Message', 'Settings'];

const INITIAL_FORM = {
  name: '',
  audience_type: 'client',
  audience_scope: 'tags',
  tag_ids: [],
  exclude_tag_ids: [],
  subject_template: '',
  body_template: '',
  personalization_notes: '',
  sender_mode: 'record_owner',
  owner_filter: 'all',
  cc_emails: [],
  template_source_id: '',
  selected_ctas: [],
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
    if (step === 1) return form.name.trim() !== '' && (form.audience_scope === 'all' || form.tag_ids.length > 0);
    if (step === 2) return form.subject_template.trim() !== '' && form.body_template.trim() !== '';
    return true;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const campaign = await base44.entities.OutreachCampaign.create({
        name: form.name,
        audience_type: form.audience_type,
        audience_scope: form.audience_scope || 'tags',
        tag_ids: form.tag_ids,
        exclude_tag_ids: form.exclude_tag_ids || [],
        subject_template: form.subject_template,
        body_template: form.body_template,
        personalization_notes: form.personalization_notes,
        sender_mode: form.sender_mode,
        owner_filter: form.owner_filter || 'all',
        cc_emails: form.cc_emails,
        ...(form.template_source_id ? { template_source_id: form.template_source_id } : {}),
        selected_ctas: form.selected_ctas || [],
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
      {/* Window-sized like the other working dialogs (RecordDetailFrame): wide on
          desktop, bottom sheet on phones, header + buttons pinned. */}
      <RecordDetailContent maxWidth="1120px" fill={false}>
        <RecordDetailFrame
          header={
            <div className="space-y-2">
              <DialogTitle className="text-lg">New Outreach Campaign</DialogTitle>
              {/* Step indicator */}
              <div className="flex items-center gap-2 flex-wrap">
                {STEP_LABELS.map((label, i) => {
                  const s = i + 1;
                  return (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${s === step ? 'w-8 bg-[#264d44]' : s < step ? 'w-4 bg-[#264d44]/40' : 'w-4 bg-gray-200'}`} />
                      <span className={`text-xs ${s === step ? 'font-semibold text-[#264d44]' : 'text-gray-400'}`}>{label}</span>
                    </div>
                  );
                })}
                <span className="text-xs text-gray-400 ml-1">· Step {step} of 3</span>
              </div>
            </div>
          }
          footer={
            <div className="flex justify-between gap-2">
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
          }
        >
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
        </RecordDetailFrame>
      </RecordDetailContent>
    </Dialog>
  );
}