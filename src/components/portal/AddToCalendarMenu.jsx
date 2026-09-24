import React, { useState } from 'react';
import { CalendarPlus, Calendar } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { googleCalendarUrl, outlookComUrl, outlook365Url } from '@/lib/calendarLinks';
import { downloadICS } from '@/lib/ics';

// Each provider's own site icon, via Google's public favicon service — so the
// menu shows the real Google Calendar / Outlook / Apple marks without us
// bundling brand artwork. Falls back to a plain calendar icon if it can't load.
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

function ProviderIcon({ domain }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Calendar className="w-4 h-4 text-gray-400" />;
  return (
    <img
      src={favicon(domain)}
      alt=""
      width={16}
      height={16}
      className="w-4 h-4 rounded-sm"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

const PROVIDERS = [
  { key: 'google', label: 'Google Calendar', domain: 'calendar.google.com', href: googleCalendarUrl },
  { key: 'o365', label: 'Outlook (work or school)', domain: 'outlook.office.com', href: outlook365Url },
  { key: 'outlook', label: 'Outlook.com (personal)', domain: 'outlook.live.com', href: outlookComUrl },
];

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
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Add to your calendar</DropdownMenuLabel>
        {PROVIDERS.map(p => (
          <DropdownMenuItem key={p.key} onSelect={() => open(p.href(event))} className="gap-2.5 cursor-pointer">
            <ProviderIcon domain={p.domain} /> {p.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => downloadICS(event)} className="gap-2.5 cursor-pointer">
          <ProviderIcon domain="apple.com" /> Apple Calendar / other (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
