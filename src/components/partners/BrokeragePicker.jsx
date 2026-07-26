import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Sparkles } from 'lucide-react';
import BrokerageDialog from '@/components/partners/BrokerageDialog';
import { getOrgDomain } from '@/lib/emailDomain';

const NONE = '__none__';

/**
 * Reusable Brokerage picker.
 *
 * Props:
 *  - value         : brokerage_id or null
 *  - onChange       : (newId | null) => void
 *  - contactEmail   : email used to derive a suggested brokerage by domain match
 *  - disabled       : optional boolean
 *
 * Suggestion logic (only when value is null):
 *   Derives org domain from contactEmail, matches against every Brokerage's
 *   email_domain + email_domain_aliases. If exactly one matches → pre-select
 *   it with a "Suggested" label. If multiple match → select nothing, show
 *   a "claimed by multiple firms" warning. Free-mail → no suggestion.
 */
export default function BrokeragePicker({ value, onChange, contactEmail, disabled }) {
  const qc = useQueryClient();
  const [showBrokerageDialog, setShowBrokerageDialog] = useState(false);

  const { data: brokerages = [] } = useQuery({
    queryKey: ['brokerages'],
    queryFn: () => base44.entities.Brokerage.list('name', 500)
  });

  const sorted = [...brokerages].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  // ── Suggestion: only when value is null and we have a contact email ──
  let suggestion = null;
  let suggestionLabel = null;
  if (!value && contactEmail) {
    const domain = getOrgDomain(contactEmail);
    if (domain) {
      const matches = sorted.filter(b => {
        const primary = (b.email_domain || '').toLowerCase().trim();
        const aliases = (b.email_domain_aliases || []).map(a => String(a).toLowerCase().trim());
        return primary === domain || aliases.includes(domain);
      });
      if (matches.length === 1) {
        suggestion = matches[0];
        suggestionLabel = `Suggested — matches ${domain}`;
      } else if (matches.length > 1) {
        suggestionLabel = `Domain ${domain} claimed by multiple firms`;
      }
    }
  }

  // The effective value: if value is null but we have a suggestion, show it as pre-selected
  const effectiveValue = value || (suggestion ? suggestion.id : NONE);

  const handleChange = (val) => {
    if (val === NONE) {
      onChange(null);
    } else {
      onChange(val);
    }
  };

  const handleBrokerageSaved = async () => {
    // Invalidate so the new brokerage shows up in the list
    await qc.invalidateQueries({ queryKey: ['brokerages'] });
    // The BrokerageDialog doesn't return the created record, so we
    // refetch and find the newest one (highest created_date)
    const refreshed = await base44.entities.Brokerage.list('-created_date', 1);
    if (refreshed.length > 0) {
      onChange(refreshed[0].id);
    }
  };

  const selectedBrokerage = brokerages.find(b => b.id === effectiveValue);
  const showSuggestionBadge = !!suggestion && !value;

  return (
    <div className="space-y-1">
      <Select
        value={effectiveValue}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full bg-gray-50">
          <SelectValue placeholder="None (solo partner)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-gray-400 italic">— Solo — no brokerage —</span>
          </SelectItem>
          {sorted.map(b => (
            <SelectItem key={b.id} value={b.id}>
              <div className="flex flex-col">
                <span>{b.name}</span>
                {b.email_domain && (
                  <span className="text-xs text-gray-400">{b.email_domain}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showSuggestionBadge && suggestion && (
        <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {suggestionLabel}
        </p>
      )}

      {suggestionLabel && !suggestion && (
        <p className="text-xs text-amber-600 font-medium">
          {suggestionLabel}
        </p>
      )}

      {selectedBrokerage && !value && suggestion && (
        <p className="text-xs text-gray-400 mt-0.5">
          Assignment shown above — save to confirm.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowBrokerageDialog(true)}
        className="inline-flex items-center gap-1 text-xs text-[#013f7c] hover:underline mt-0.5"
      >
        <Plus className="w-3 h-3" /> Add brokerage
      </button>

      <BrokerageDialog
        open={showBrokerageDialog}
        onOpenChange={setShowBrokerageDialog}
        onSaved={handleBrokerageSaved}
      />
    </div>
  );
}