import React, { useState } from 'react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarClock } from 'lucide-react';

/**
 * Pill showing "Due {date}" / "Overdue" / "Set follow-up".
 * Click opens a date picker; saves on pick.
 * Tints amber when due ≤7 days, red when overdue.
 *
 * Props:
 *  - value:  ISO date string (yyyy-MM-dd) or null
 *  - onSave: (dateString) => void  — called with 'yyyy-MM-dd' format
 */
export function FollowUpDatePill({ value, onSave }) {
  const [open, setOpen] = useState(false);

  let parsed = null;
  if (value) {
    try {
      const d = parseISO(value);
      if (isValid(d)) parsed = d;
    } catch { parsed = null; }
  }

  const days = parsed ? differenceInDays(parsed, new Date()) : null;

  let style = 'bg-gray-100 text-gray-500 hover:bg-gray-200';
  let label = 'Set follow-up';

  if (days !== null) {
    if (days < 0) {
      style = 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100';
      label = `Overdue ${Math.abs(days)}d`;
    } else if (days <= 7) {
      style = 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100';
      label = days === 0 ? 'Due today' : `Due ${format(parsed, 'MMM d')}`;
    } else {
      label = `Due ${format(parsed, 'MMM d')}`;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${style}`}>
          <CalendarClock className="w-3 h-3 shrink-0" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed || undefined}
          onSelect={(date) => {
            if (date) {
              onSave(format(date, 'yyyy-MM-dd'));
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default FollowUpDatePill;