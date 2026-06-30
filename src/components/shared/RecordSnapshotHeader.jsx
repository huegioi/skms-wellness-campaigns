import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { InlineText } from '@/components/shared/inline/InlineText';
import { OwnerChip } from '@/components/shared/inline/OwnerChip';
import { StageControl } from '@/components/shared/inline/StageControl';
import { FollowUpDatePill } from '@/components/shared/inline/FollowUpDatePill';
import { TagSelector } from '@/components/ui/TagSelector';

/**
 * Shared "snapshot" header for the top of every detail view.
 * Shows avatar/initials + editable name & company, then a wrap of chips:
 * OwnerChip, StageControl, FollowUpDatePill, TagSelector.
 *
 * Props:
 *  - record:     the entity record (must have id, name, company, owner, tags, follow_up_due_date)
 *  - entityType: 'Lead' | 'Client' | 'ReferralPartner'
 *  - stages:     the stage list to pass to StageControl (LEAD_STAGES / CLIENT_STAGES / PARTNER_STAGES)
 */
export function RecordSnapshotHeader({ record, entityType, stages }) {
  const queryClient = useQueryClient();

  const queryKey =
    entityType === 'Lead' ? ['leads']
    : entityType === 'Client' ? ['clients']
    : ['referralPartners'];

  const update = async (updates) => {
    // Optimistic update
    queryClient.setQueryData(queryKey, (old) => {
      if (!Array.isArray(old)) return old;
      return old.map(r => (r.id === record.id ? { ...r, ...updates } : r));
    });
    try {
      await base44.entities[entityType].update(record.id, updates);
    } catch (e) {
      // Revert on error by invalidating
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
      // Side effect: Active Partner → is_active: true; anything else → is_active: false
      // This ensures portal provisioning fires when promoted to Active Partner.
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
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-[#013f7c] text-white flex items-center justify-center text-lg font-bold shrink-0">
        {initials}
      </div>

      {/* Editable name & company */}
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

      {/* Chip wrap */}
      <div className="flex flex-wrap items-center gap-2">
        <OwnerChip
          value={record.owner}
          onSave={(v) => update({ owner: v })}
        />
        <StageControl
          stages={stages}
          value={stageValue}
          onSave={handleStageChange}
        />
        <FollowUpDatePill
          value={record.follow_up_due_date}
          onSave={(v) => update({ follow_up_due_date: v })}
        />
        <div className="min-w-[120px]">
          <TagSelector
            value={record.tags || []}
            onChange={(tags) => update({ tags })}
          />
        </div>
      </div>
    </div>
  );
}

export default RecordSnapshotHeader;