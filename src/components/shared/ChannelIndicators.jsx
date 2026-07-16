import React from 'react';
import { Linkedin, Mail, Phone, MessageSquare, Users } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const CHANNELS = [
  { key: 'linkedin', icon: Linkedin,      color: '#0a66c2', label: 'LinkedIn' },
  { key: 'email',    icon: Mail,           color: '#3b82f6', label: 'Email' },
  { key: 'phone',    icon: Phone,          color: '#22c55e', label: 'Phone' },
  { key: 'text',     icon: MessageSquare,  color: '#a855f7', label: 'Text' },
  { key: 'meeting',  icon: Users,          color: '#f59e0b', label: 'Meeting' },
];

function fmtDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return null;
    return format(d, 'MMM d');
  } catch {
    return null;
  }
}

export function ChannelIndicators({ summary }) {
  if (!summary) return null;
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {CHANNELS.map(({ key, icon: Icon, color, label }) => {
        const entry = summary[key];
        const dateStr = fmtDate(entry?.date);
        const tooltip = entry
          ? `${label} — last: ${dateStr || 'recently'}`
          : `No ${label.toLowerCase()} touch yet.`;
        return (
          <span key={key} title={tooltip} className="inline-flex">
            <Icon
              className="w-3.5 h-3.5"
              style={{ color: entry ? color : '#d1d5db' }}
            />
          </span>
        );
      })}
    </div>
  );
}

export default ChannelIndicators;