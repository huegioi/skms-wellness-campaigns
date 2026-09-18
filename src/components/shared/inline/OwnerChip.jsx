import React from 'react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ArrowLeftRight } from 'lucide-react';
import { OWNERS } from '@/components/shared/constants';
import { parseOwners, joinOwners } from '@/lib/owners';

const initialOf = (name) => (name || '').trim().charAt(0).toUpperCase() || '?';

/**
 * Owner chip — a record can have MORE THAN ONE owner.
 *
 * `value` is the stored owner string ("William" or "William, Heather"); the
 * menu toggles each owner with a checkbox and saves immediately via
 * onSave(joinedString). The FIRST owner listed is the primary — campaign
 * drafts go out from that mailbox — so a two-owner chip offers "Swap primary".
 * "Unassigned" clears everyone.
 */
export function OwnerChip({ value, onSave }) {
  const owners = parseOwners(value);
  // Any name in the data that isn't in OWNERS (legacy/imported) still shows and can be unticked.
  const menuNames = [...OWNERS, ...owners.filter(o => !OWNERS.some(k => k.toLowerCase() === o.toLowerCase()))];

  const toggle = (name) => {
    const has = owners.some(o => o.toLowerCase() === name.toLowerCase());
    const next = has ? owners.filter(o => o.toLowerCase() !== name.toLowerCase()) : [...owners, name];
    onSave(joinOwners(next));
  };

  const swapPrimary = () => {
    if (owners.length < 2) return;
    onSave(joinOwners([owners[1], owners[0], ...owners.slice(2)]));
  };

  const label = owners.length === 0
    ? <span className="text-gray-400">Unassigned</span>
    : owners.join(', ');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors pl-1 pr-2.5 py-0.5 text-xs font-medium text-gray-700"
          title={owners.length > 1 ? `Owners: ${owners.join(', ')} (primary: ${owners[0]})` : undefined}
        >
          <span className="flex items-center -space-x-1.5">
            {owners.length === 0 ? (
              <span className="w-5 h-5 rounded-full bg-[#013f7c] text-white flex items-center justify-center text-[10px] font-bold shrink-0">?</span>
            ) : owners.map((o, i) => (
              <span
                key={o}
                className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0 ring-2 ring-gray-100 ${i === 0 ? 'bg-[#013f7c]' : 'bg-[#770142]'}`}
              >
                {initialOf(o)}
              </span>
            ))}
          </span>
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-[11px] font-normal text-gray-500">
          Owners — tick one or more
        </DropdownMenuLabel>
        {menuNames.map(name => {
          const idx = owners.findIndex(o => o.toLowerCase() === name.toLowerCase());
          const checked = idx >= 0;
          return (
            <DropdownMenuCheckboxItem
              key={name}
              checked={checked}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(name)}
              className={checked ? 'font-semibold text-[#013f7c]' : ''}
            >
              {name}
              {checked && idx === 0 && owners.length > 1 && (
                <span className="ml-auto text-[10px] font-normal text-gray-400">primary</span>
              )}
            </DropdownMenuCheckboxItem>
          );
        })}
        {owners.length > 1 && (
          <DropdownMenuItem onClick={swapPrimary} className="gap-2 text-gray-600">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Make {owners[1]} primary
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSave('')}
          className={owners.length === 0 ? 'font-semibold text-gray-500' : 'text-gray-500'}
        >
          {owners.length === 0 ? '✓ ' : ''}Unassigned
        </DropdownMenuItem>
        {owners.length > 1 && (
          <p className="px-2 pt-1 pb-1.5 text-[10px] leading-snug text-gray-400">
            The primary owner's mailbox sends campaign drafts for this record.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default OwnerChip;
