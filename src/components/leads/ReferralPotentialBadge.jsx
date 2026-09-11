import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Star, Check, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// Single source of truth for how referral potential looks everywhere it is shown.
export const REFERRAL_POTENTIAL_CONFIG = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  high:   { label: 'High',   color: 'bg-green-100 text-green-700 border-green-200' },
};

const OPTIONS = ['high', 'medium', 'low'];

/**
 * The "<Level> potential" chip — click it to change the level in place.
 *
 * Writes straight to the Lead record and refreshes the leads list, so it works
 * the same on the List cards and on the Pipeline cards.
 *
 * Props:
 *   lead        — the Lead record (needs id + referral_potential)
 *   size        — 'sm' (default) or 'xs' for the tighter pipeline cards
 *   showWhenUnset — render a faint "Set potential" chip when the lead has none
 */
export default function ReferralPotentialBadge({ lead, size = 'sm', showWhenUnset = true, className = '' }) {
  const queryClient = useQueryClient();
  const current = lead?.referral_potential || '';
  const cfg = REFERRAL_POTENTIAL_CONFIG[current] || null;

  const mutation = useMutation({
    mutationFn: (value) => base44.entities.Lead.update(lead.id, { referral_potential: value || null }),
    onSuccess: (_data, value) => {
      // Patch the cached list right away so the chip updates without a flash.
      queryClient.setQueryData(['leads'], (old) =>
        (old || []).map(l => (l.id === lead.id ? { ...l, referral_potential: value || '' } : l))
      );
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['broker-lead', lead.id] });
      toast.success(
        value
          ? `${lead.name || 'Partner'} set to ${REFERRAL_POTENTIAL_CONFIG[value].label} potential`
          : 'Referral potential cleared'
      );
    },
    onError: (e) => toast.error('Could not update potential: ' + e.message),
  });

  if (!cfg && !showWhenUnset) return null;

  const sizing = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5 gap-0.5'
    : 'text-xs px-2 py-0.5 gap-1';
  const icon = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  const trigger = cfg
    ? `${cfg.color} ${sizing}`
    : `bg-gray-50 text-gray-400 border-dashed border-gray-300 ${sizing}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // Pipeline cards are draggable and open a detail panel on click —
          // keep both from firing when the chip itself is what was clicked.
          onClick={(e) => { e.stopPropagation(); }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          disabled={mutation.isPending}
          title="Click to change referral potential"
          className={`inline-flex items-center rounded-full border font-medium transition-all hover:brightness-95 hover:ring-1 hover:ring-gray-300 disabled:opacity-60 ${trigger} ${className}`}
        >
          {mutation.isPending
            ? <Loader2 className={`${icon} animate-spin`} />
            : <Star className={icon} />}
          {cfg ? `${cfg.label} potential` : 'Set potential'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Referral potential</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(key => (
          <DropdownMenuItem
            key={key}
            onSelect={() => { if (key !== current) mutation.mutate(key); }}
            className="text-sm cursor-pointer"
          >
            <span className={`w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0 ${
              key === 'high' ? 'bg-green-500' : key === 'medium' ? 'bg-amber-400' : 'bg-slate-400'
            }`} />
            {REFERRAL_POTENTIAL_CONFIG[key].label}
            {key === current && <Check className="w-3.5 h-3.5 ml-auto text-gray-500" />}
          </DropdownMenuItem>
        ))}
        {current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => mutation.mutate('')}
              className="text-sm text-gray-500 cursor-pointer"
            >
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
