import React from 'react';
import { CalendarPlus, Download } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { googleCalendarUrl, outlookComUrl, outlook365Url } from '@/lib/calendarLinks';
import { downloadICS } from '@/lib/ics';

// One button → pick your calendar. Google / Outlook open a pre-filled event in a
// new tab (just click Save); Apple & others download a .ics that opens in the
// default calendar app.
export default function AddToCalendarMenu({ event, compact = false, className = '' }) {
  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-green hover:text-brand-green transition-colors ${className}`}
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          {compact ? 'Add' : 'Add to calendar'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Add to your calendar</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => open(googleCalendarUrl(event))}>Google Calendar</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => open(outlook365Url(event))}>Outlook (work or school)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => open(outlookComUrl(event))}>Outlook.com (personal)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => downloadICS(event)}>
          <Download className="w-3.5 h-3.5 mr-2" /> Apple Calendar / other (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
