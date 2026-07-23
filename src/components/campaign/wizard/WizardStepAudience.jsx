import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { TagSelector } from '@/components/ui/TagSelector';
import { Users, AlertCircle } from 'lucide-react';

const AUDIENCE_TYPES = [
  { value: 'client', label: 'Clients', entity: 'Client' },
  { value: 'lead', label: 'Leads', entity: 'Lead' },
  { value: 'referral_partner', label: 'Referral Partners', entity: 'ReferralPartner' },
];

export default function WizardStepAudience({ form, updateForm, excludedIds, toggleExclude }) {
  const selectedType = AUDIENCE_TYPES.find(t => t.value === form.audience_type) || AUDIENCE_TYPES[0];

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['audience_preview', form.audience_type],
    queryFn: () => base44.entities[selectedType.entity].list('-created_date', 500),
  });

  const matchedRecords = form.tag_ids.length === 0 ? [] : allRecords
    .filter(r => !r.is_demo)
    .filter(r => r.tags && r.tags.some(t => form.tag_ids.includes(t)));

  // ── Duplicate outreach check: flag emails in other campaigns (drafted+, last 30 days) ──
  const { data: duplicateMap = {} } = useQuery({
    queryKey: ['duplicate_outreach_check'],
    queryFn: async () => {
      const [recipients, campaigns] = await Promise.all([
        base44.entities.CampaignRecipient.list('-created_date', 500),
        base44.entities.OutreachCampaign.list('-created_date', 500),
      ]);
      const campaignNameMap = {};
      for (const c of campaigns) campaignNameMap[c.id] = c.name;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const map = {};
      for (const r of recipients) {
        if (!['drafted', 'approved', 'sent', 'replied'].includes(r.status)) continue;
        const createdDate = new Date(r.created_date);
        if (createdDate < thirtyDaysAgo) continue;
        const email = (r.email || '').toLowerCase().trim();
        if (!email) continue;
        const cName = campaignNameMap[r.campaign_id] || 'Unknown';
        const dateStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!map[email]) {
          map[email] = `Also in campaign "${cName}" (${dateStr})`;
        }
      }
      return map;
    },
  });

  const finalCount = matchedRecords.filter(r => !excludedIds.includes(r.id)).length;
  const noEmailCount = matchedRecords.filter(r => !excludedIds.includes(r.id) && !r.email).length;

  return (
    <div className="space-y-4">
      {/* Campaign name */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1 block">Campaign Name *</Label>
        <Input
          placeholder="e.g., Q3 Re-engagement Outreach"
          value={form.name}
          onChange={e => updateForm('name', e.target.value)}
        />
      </div>

      {/* Audience type */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Audience Type *</Label>
        <RadioGroup
          value={form.audience_type}
          onValueChange={v => { updateForm('audience_type', v); updateForm('tag_ids', []); }}
          className="grid grid-cols-3 gap-2"
        >
          {AUDIENCE_TYPES.map(t => (
            <div key={t.value} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
              <RadioGroupItem value={t.value} id={`audience-${t.value}`} />
              <label htmlFor={`audience-${t.value}`} className="text-sm cursor-pointer flex-1">{t.label}</label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Tags */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1 block">Tags (match ANY) *</Label>
        <TagSelector
          value={form.tag_ids}
          onChange={v => updateForm('tag_ids', v)}
        />
        <p className="text-xs text-gray-500 mt-1">Records with any of these tags will be included.</p>
      </div>

      {/* Live preview */}
      {form.tag_ids.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Matched Records ({matchedRecords.length})
            </Label>
            <span className="text-xs text-gray-500">
              {finalCount} included{noEmailCount > 0 && ` - ${noEmailCount} will be skipped (no email)`}
            </span>
          </div>

          {isLoading ? (
            <div className="text-sm text-gray-400 py-4 text-center">Loading...</div>
          ) : matchedRecords.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center border rounded-lg">
              No records match the selected tags.
            </div>
          ) : (
            <div className="border rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-50">
              {matchedRecords.map(r => {
                const isExcluded = excludedIds.includes(r.id);
                const hasNoEmail = !r.email;
                return (
                  <div key={r.id} className={`flex items-center gap-3 px-3 py-2 ${isExcluded ? 'opacity-40' : ''}`}>
                    <Checkbox
                      checked={!isExcluded}
                      onCheckedChange={() => toggleExclude(r.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.name || '(no name)'}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {r.email || 'No email'} - {r.company || 'No company'}
                      </p>
                    </div>
                    {hasNoEmail && !isExcluded && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 shrink-0">
                        <AlertCircle className="w-3 h-3" /> will be skipped
                      </span>
                    )}
                    {r.email && duplicateMap[r.email.toLowerCase().trim()] && !isExcluded && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 shrink-0 max-w-[200px] truncate" title={duplicateMap[r.email.toLowerCase().trim()]}>
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {duplicateMap[r.email.toLowerCase().trim()]}
                      </span>
                    )}
                    {r.owner && (
                      <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{r.owner}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}