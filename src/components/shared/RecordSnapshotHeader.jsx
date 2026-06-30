import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { InlineText } from '@/components/shared/inline/InlineText';
import { OwnerChip } from '@/components/shared/inline/OwnerChip';
import { StageControl } from '@/components/shared/inline/StageControl';
import { FollowUpDatePill } from '@/components/shared/inline/FollowUpDatePill';
import { TagSelector } from '@/components/ui/TagSelector';
import TagManager from '@/components/ui/TagManager';

export function RecordSnapshotHeader({ record, entityType, stages, onUpdate }) {
  const queryClient = useQueryClient();
  const [showTagManager, setShowTagManager] = useState(false);

  const queryKey =
    entityType === 'Lead' ? ['leads']
    : entityType === 'Client' ? ['clients']
    : ['referralPartners'];

  const update = async (updates) => {
    if (onUpdate) {
      onUpdate(updates);
      return;
    }
    queryClient.setQueryData(queryKey, (old) => {
      if (!Array.isArray(old)) return old;
      return old.map(r => (r.id === record.id ? { ...r, ...updates } : r));
    });
    try {
      await base44.entities[entityType].update(record.id, updates);
    } catch (e) {
      queryClient.invalidateQueries({ queryKey });
    }
    queryClient.invalidateQueries({ queryKey });
  };

  const handleStageChange = (newStage) => {
    const updates = {};
    if (entityType === 'Lead') {
      updates.follow_up_stage = newStage;
    } else if (entityType === 'Client') {
      updates.client_stage = newStage;
    } else if (entityType === 'ReferralPartner') {
      updates.partner_status = newStage;
      updates.is_active = newStage === 'Active Partner';
    }
    update(updates);
  };

  const initials = record.name
    ? record.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const stageField =
    entityType === 'Lead' ? 'follow_up_stage'
    : entityType === 'Client' ? 'client_stage'
    : 'partner_status';

  const stageValue = record[stageField];

  return (
    <div className="flex items-start gap-3 flex-wrap p-4 bg-white rounded-xl border border-gray-200">
      <div className="w-12 h-12 rounded-full bg-[#013f7c] text-white flex items-center justify-center text-lg font-bold shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-[180px]">
        <InlineText
          value={record.name}
          onSave={(v) => update({ name: v })}
          className="text-lg font-bold text-[#013f7c]"
        />
        <InlineText
          value={record.company}
          onSave={(v) => update({ company: v })}
          className="text-sm text-gray-500"
          placeholder="Add company"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OwnerChip value={record.owner} onSave={(v) => update({ owner: v })} />
        <StageControl stages={stages} value={stageValue} onSave={handleStageChange} />
        <FollowUpDatePill value={record.follow_up_due_date} onSave={(v) => update({ follow_up_due_date: v })} />
        <div className="min-w-[120px]">
          <TagSelector
            value={record.tags || []}
            onManageTags={() => setShowTagManager(true)}
            onChange={(tags) => update({ tags })}
          />
        </div>
      </div>
      <TagManager open={showTagManager} onOpenChange={setShowTagManager} />
    </div>
  );
}

export default RecordSnapshotHeader;