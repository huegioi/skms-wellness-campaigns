import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { TagSelector } from '@/components/ui/TagSelector';
import { Users, AlertCircle, Minus } from 'lucide-react';

const AUDIENCE_TYPES = [
  { value: 'client', label: 'Clients', entities: ['Client'] },
  { value: 'partner', label: 'Partners', entities: ['Lead', 'ReferralPartner'] },
];

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All {type}' },
  { value: 'tags', label: 'By tag' },
];

export default function WizardStepAudience({ form, updateForm, excludedIds, toggleExclude }) {
  const selectedType = AUDIENCE_TYPES.find(t => t.value === form.audience_type) || AUDIENCE_TYPES[0];
  const isAllScope = form.audience_scope === 'all';
  const typeLabel = selectedType.label.toLowerCase();
  const excludeTagIds = form.exclude_tag_ids || [];
  const conflictingTags = form.tag_ids.filter(t => excludeTagIds.includes(t));

  // ── Activity filter: for "All Partners" scope, exclude dead/inactive records ──
  // Leads with these statuses are "dead/lost" and excluded from the partners list.
  // ReferralPartners that are Inactive or is_active=false are also excluded.
  const DEAD_LEAD_STATUSES = ['not_interested', 'converted', 'current_client'];
  const isInactivePartnerRecord = (r) => {
    if (r._sourceType === 'lead') return DEAD_LEAD_STATUSES.includes(r.status);
    if (r._sourceType === 'referral_partner') return r.partner_status === 'Inactive' || r.is_active === false;
    return false;
  };
  const isPartnerAllScope = isAllScope && form.audience_type === 'partner';
  const inactiveExcludedCount = isPartnerAllScope
    ? allRecords.filter(r => !r.is_demo && isInactivePartnerRecord(r)).length
    : 0;

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['audience_preview', form.audience_type],
    queryFn: async () => {
      const results = await Promise.all(
        selectedType.entities.map(name => base44.entities[name].list('-created_date', 500))
      );
      const tagged = [];
      selectedType.entities.forEach((entityName, i) => {
        const recordType = entityName === 'ReferralPartner' ? 'referral_partner' : entityName.toLowerCase();
        for (const r of results[i]) tagged.push({ ...r, _sourceType: recordType });
      });
      return tagged;
    },
  });

  // ── Compute tag-excluded count (before dedup, for summary line) ──
  const tagExcludedCount = excludeTagIds.length === 0 ? 0 : (() => {
    let basePool = allRecords.filter(r => !r.is_demo);
    if (!isAllScope) {
      basePool = basePool.filter(r => r.tags && r.tags.some(t => form.tag_ids.includes(t)));
    }
    return basePool.filter(r => r.tags && r.tags.some(t => excludeTagIds.includes(t))).length;
  })();

  const matchedRecords = (() => {
    if (!isAllScope && form.tag_ids.length === 0) return [];
    let pool = allRecords.filter(r => !r.is_demo);
    // For "All Partners" scope, exclude dead/inactive records
    if (isPartnerAllScope) {
      pool = pool.filter(r => !isInactivePartnerRecord(r));
    }
    if (!isAllScope) {
      pool = pool.filter(r => r.tags && r.tags.some(t => form.tag_ids.includes(t)));
    }
    // Exclude by tag: remove records with ANY exclude tag
    if (excludeTagIds.length > 0) {
      pool = pool.filter(r => !(r.tags && r.tags.some(t => excludeTagIds.includes(t))));
    }
    if (form.audience_type !== 'partner') return pool;
    // Partner: dedupe by email, prefer ReferralPartner over Lead
    const byEmail = new Map();
    for (const r of pool.filter(r => r._sourceType === 'referral_partner')) {
      const key = (r.email || '').toLowerCase().trim() || `_noid_${r.id}`;
      if (!byEmail.has(key)) byEmail.set(key, r);
    }
    for (const r of pool.filter(r => r._sourceType === 'lead')) {
      const key = (r.email || '').toLowerCase().trim() || `_noid_${r.id}`;
      if (!byEmail.has(key)) byEmail.set(key, r);
    }
    return Array.from(byEmail.values());
  })();

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
  const showPreview = isAllScope || form.tag_ids.length > 0;

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
          className="grid grid-cols-2 gap-2"
        >
          {AUDIENCE_TYPES.map(t => (
            <div key={t.value} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
              <RadioGroupItem value={t.value} id={`audience-${t.value}`} />
              <label htmlFor={`audience-${t.value}`} className="text-sm cursor-pointer flex-1">{t.label}</label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Audience scope: All vs By tag */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Audience Scope *</Label>
        <RadioGroup
          value={form.audience_scope || 'tags'}
          onValueChange={v => updateForm('audience_scope', v)}
          className="grid grid-cols-2 gap-2"
        >
          {SCOPE_OPTIONS.map(opt => (
            <div key={opt.value} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
              <RadioGroupItem value={opt.value} id={`scope-${opt.value}`} />
              <label htmlFor={`scope-${opt.value}`} className="text-sm cursor-pointer flex-1 capitalize">
                {opt.label.replace('{type}', typeLabel)}
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Tags — only when scope is 'tags' */}
      {!isAllScope && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">Tags (match ANY) *</Label>
          <TagSelector
            value={form.tag_ids}
            onChange={v => updateForm('tag_ids', v)}
          />
          <p className="text-xs text-gray-500 mt-1">Records with any of these tags will be included.</p>
        </div>
      )}

      {/* Exclude by tag */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1">
          <Minus className="w-3 h-3" />
          Exclude by tag
        </Label>
        <TagSelector
          value={excludeTagIds}
          onChange={v => updateForm('exclude_tag_ids', v)}
        />
        <p className="text-xs text-gray-500 mt-1">Records with any of these tags are removed from the audience.</p>
        {conflictingTags.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {conflictingTags.length} tag{conflictingTags.length > 1 ? 's' : ''} selected in both include and exclude — exclude wins: {conflictingTags.join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* High-volume note */}
      {showPreview && finalCount > 25 && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Maya will draft {finalCount} individual emails — this may take a few minutes and use more AI credits.</span>
        </div>
      )}

      {/* Live preview */}
      {showPreview && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Matched Records ({matchedRecords.length})
            </Label>
            <span className="text-xs text-gray-500">
              {finalCount} included{noEmailCount > 0 && ` - ${noEmailCount} will be skipped (no email)`}
              {tagExcludedCount > 0 && ` - ${tagExcludedCount} excluded by tag`}
              {inactiveExcludedCount > 0 && ` - ${inactiveExcludedCount} inactive/old excluded`}
            </span>
          </div>

          {isLoading ? (
            <div className="text-sm text-gray-400 py-4 text-center">Loading...</div>
          ) : matchedRecords.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center border rounded-lg">
              {isAllScope ? 'No records found.' : 'No records match the selected tags.'}
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
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {r.name || '(no name)'}
                        {form.audience_type === 'partner' && r._sourceType && (
                          <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                            {r._sourceType === 'referral_partner' ? 'RP' : 'L'}
                          </span>
                        )}
                      </p>
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