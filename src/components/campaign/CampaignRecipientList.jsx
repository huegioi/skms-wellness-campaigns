import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, UserX } from 'lucide-react';

const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-600',
  drafting: 'bg-blue-100 text-blue-700',
  drafted: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  sent: 'bg-purple-100 text-purple-700',
  replied: 'bg-teal-100 text-teal-700',
  skipped: 'bg-gray-100 text-gray-400',
  error: 'bg-red-100 text-red-700',
};

const FILTER_STATUSES = ['pending', 'drafting', 'drafted', 'approved', 'error'];

// Rows whose client record has no human contact name for the address we're
// mailing. The draft greets them without a name rather than inventing one from
// the email address, so these are worth fixing before approving anything.
const NEEDS_NAME = 'needs_name';

export default function CampaignRecipientList({ recipients, selectedId, onSelect }) {
  const [filter, setFilter] = useState('all');

  const counts = {};
  for (const r of recipients) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  const needsNameCount = recipients.filter(r => r.contact_name_missing).length;

  const filtered =
    filter === 'all' ? recipients
    : filter === NEEDS_NAME ? recipients.filter(r => r.contact_name_missing)
    : recipients.filter(r => r.status === filter);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-gray-100">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-[#264d44] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({recipients.length})
        </button>
        {FILTER_STATUSES.map(status => {
          if (!counts[status]) return null;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                filter === status ? 'bg-[#264d44] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status} ({counts[status]})
            </button>
          );
        })}
        {needsNameCount > 0 && (
          <button
            onClick={() => setFilter(NEEDS_NAME)}
            title="No contact name on the client record for this address"
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
              filter === NEEDS_NAME
                ? 'bg-amber-600 text-white'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            }`}
          >
            <UserX className="w-3 h-3" />
            needs a name ({needsNameCount})
          </button>
        )}
      </div>

      {/* Recipient list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No recipients in this category.</div>
        ) : (
          filtered.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                selectedId === r.id ? 'bg-[#264d44]/5 border-l-2 border-l-[#264d44]' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* With no contact name the company carries the row, so an
                      unresolved contact never renders as a blank line. */}
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {r.name || r.company || '(no name)'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {r.name ? (r.company || '-') : (r.email || '-')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(r.followup_round || 0) >= 1 && (
                    <Badge className="text-[10px] border-0 bg-[#770142]/10 text-[#770142] px-1.5">R{r.followup_round}</Badge>
                  )}
                  {r.contact_name_missing && (
                    <Badge className="text-[10px] border-0 bg-amber-100 text-amber-800 px-1.5">no contact</Badge>
                  )}
                  {r.thin_context && (
                    <Badge className="text-[10px] border-0 bg-orange-100 text-orange-700 px-1.5">thin</Badge>
                  )}
                  <Badge className={`text-[10px] border-0 ${STATUS_STYLES[r.status] || 'bg-gray-100'}`}>{r.status}</Badge>
                </div>
              </div>
              {r.contact_name_missing && (
                <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>No contact name on the client record — this draft greets without one. Add the person on the client's Contacts tab, then Refresh the audience.</span>
                </p>
              )}
              {r.duplicate_warning && (
                <p className="text-xs text-amber-600 mt-1 truncate flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {r.duplicate_warning}
                </p>
              )}
              {r.error_message && (
                <p className="text-xs text-red-500 mt-1 truncate">{r.error_message}</p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}