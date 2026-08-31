import React, { useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Compact grouped dropdown for stage selection. Entity-agnostic — the caller
 * passes the appropriate stage list (LEAD_STAGES, CLIENT_STAGES, PARTNER_STAGES).
 *
 * Props:
 *  - stages: array of { key, label, group?, textClass? }
 *  - value:  current stage key (string)
 *  - onSave: (newKey) => void  — called with '' when "No Stage" is selected
 */
export function StageControl({ stages, value, onSave }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of stages) {
      const g = s.group || 'Stages';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(s);
    }
    return [...map.entries()];
  }, [stages]);

  const current = stages.find(s => s.key === value);
  const hasNoneOption = stages.some(s => s.key === '__none__' || s.key === '');
  const hasGroups = groups.length > 1;

  return (
    <Select
      value={value || '__none__'}
      onValueChange={(v) => onSave(v === '__none__' ? '' : v)}
    >
      <SelectTrigger className="h-9 sm:h-7 w-auto gap-1 rounded-full border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-medium px-3 sm:px-2.5 max-w-[180px]">
        <SelectValue>
          <span className={`truncate ${current?.textClass || 'text-gray-600'}`}>
            {current?.label || 'No Stage'}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {!hasNoneOption && (
          <SelectItem value="__none__">— No Stage —</SelectItem>
        )}
        {hasGroups ? (
          groups.map(([group, items]) => (
            <SelectGroup key={group}>
              <SelectLabel className="text-[10px] uppercase tracking-wide text-gray-400">
                {group}
              </SelectLabel>
              {items.map(s => (
                <SelectItem key={s.key} value={s.key || '__none__'}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))
        ) : (
          stages.map(s => (
            <SelectItem key={s.key} value={s.key || '__none__'}>
              {s.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

export default StageControl;