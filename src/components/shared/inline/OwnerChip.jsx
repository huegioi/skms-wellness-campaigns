import React from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { OWNERS } from '@/components/shared/constants';

/**
 * Shows an initials circle + owner name. Click opens a menu of OWNERS
 * (plus "Unassigned"). Calls onSave immediately on selection.
 */
export function OwnerChip({ value, onSave }) {
  const initials = value
    ? value.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors pl-1 pr-2.5 py-0.5 text-xs font-medium text-gray-700">
          <span className="w-5 h-5 rounded-full bg-[#013f7c] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
            {initials}
          </span>
          {value || <span className="text-gray-400">Unassigned</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {OWNERS.map(owner => (
          <DropdownMenuItem
            key={owner}
            onClick={() => onSave(owner)}
            className={value === owner ? 'font-semibold text-[#013f7c]' : ''}
          >
            {value === owner ? '✓ ' : ''}{owner}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSave('')}
          className={(!value) ? 'font-semibold text-gray-500' : 'text-gray-500'}
        >
          {!value ? '✓ ' : ''}Unassigned
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default OwnerChip;