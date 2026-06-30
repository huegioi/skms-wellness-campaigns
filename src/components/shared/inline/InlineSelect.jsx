import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Generic enum dropdown for inline editing.
 *
 * Props:
 *  - label:    placeholder text
 *  - options:  array of strings OR { value, label } objects
 *  - value:    current value (string)
 *  - onSave:   (newValue) => void  — called with '' when "None" is selected
 */
export function InlineSelect({ label, options, value, onSave }) {
  return (
    <Select
      value={value || '__none__'}
      onValueChange={(v) => onSave(v === '__none__' ? '' : v)}
    >
      <SelectTrigger className="h-7 w-auto gap-1 rounded-full border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-medium px-2.5 max-w-[160px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— None —</SelectItem>
        {options.map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return (
            <SelectItem key={val} value={val}>{lbl}</SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default InlineSelect;