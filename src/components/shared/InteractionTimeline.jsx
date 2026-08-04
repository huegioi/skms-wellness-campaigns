import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Phone, MessageSquare, Linkedin, Video, StickyNote, Plus, Loader2, X, Send, Inbox, FileWarning } from 'lucide-react';
import { isInternalOrganizer } from '@/lib/meetingNoteAccess';
import { FullEmailModal } from '@/components/clients/GmailHistory';
import { useSaveBadge } from '@/components/shared/SaveBadge';
import SaveBadge from '@/components/shared/SaveBadge';
import EditableInteractionNote from '@/components/shared/EditableInteractionNote';

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'meeting', label: 'Meeting', icon: Video },
];

const CHANNEL_ICONS = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
  meeting: Video,
  other: StickyNote,
};

// Map touch channel → Lead.outreach_channel enum values
const CHANNEL_TO_OUTREACH = {
  email: 'email',
  linkedin: 'linkedin',
  call: 'phone',
  text: 'other',
  meeting: 'other',
};

function relDate(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Relative date for calendar events — shows forward-looking labels for upcoming events
function calDate(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return relDate(dateStr);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `In ${diff}d`;
  return new Date(dateStr).toLocaleDateString();
}

function NoteAccessWarning({ note }) {
  return (
    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
      <FileWarning className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
      <span>
        <span className="font-medium">Meeting notes not available.</span>{' '}
        {isInternalOrganizer(note.organizer_email)
          ? <>Ask <strong>{note.organizer_email || 'the organizer'}</strong> to share their Meet Recordings folder.</>
          : <>The notes doc is owned by <strong>{note.organizer_email}</strong> outside SkillfulMeans, so it can't be pulled in automatically.</>}
        {note.doc_url && (
          <> <a href={note.doc_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open doc →</a></>
        )}
      </span>
    </div>
  );
}

export default function InteractionTimeline({ lead_id, client_id, referral_partner_id, onUpdate }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [channel, setChannel] = useState('email');
  const [note, setNote] = useState('');
  const [isContact, setIsContact] = useState(true);

  const scopeKey = lead_id
    ? ['interactions', 'lead', lead_id]
    : client_id
      ? ['interactions', 'client', client_id]
      : ['interactions', 'partner', referral_partner_id];

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: scopeKey,
    queryFn: () => {
      const f = lead_id
        ? { lead_id }
        : client_id
          ? { client_id }
          : { referral_partner_id };
      return base44.entities.ClientInteraction.filter(f, '-date');
    },
  });

  // Fetch matched EmailLog rows for the same contact and interleave chronologically
  const emailFilter = lead_id
    ? { matched_lead_id: lead_id }
    : client_id
      ? { matched_client_id: client_id }
      : referral_partner_id
        ? { matched_referral_partner_id: referral_partner_id }
        : null;

  const { data: emailLogs = [] } = useQuery({
    queryKey: [...scopeKey, 'emails'],
    queryFn: () => base44.entities.EmailLog.filter(emailFilter, '-date', 100),
    enabled: !!emailFilter,
  });

  // Fetch calendar events for the same scope and interleave chronologically
  const calFilter = lead_id
    ? { lead_id }
    : client_id
      ? { client_id }
      : referral_partner_id
        ? { referral_partner_id }
        : null;

  const { data: calendarEvents = [] } = useQuery({
    queryKey: [...scopeKey, 'calendar'],
    queryFn: () => base44.entities.CalendarEvent.filter(calFilter, '-start_date', 100),
    enabled: !!calFilter,
  });

  // Inaccessible meeting notes scoped to this contact — surfaced on the timeline
  // (attached to the matching meeting row, or rendered standalone) so the missing
  // notes aren't silently hidden. processMeetingArtifacts copies lead_id /
  // client_id / referral_partner_id onto inaccessible rows from the parent event.
  const notesFilter = lead_id
    ? { lead_id, access_status: 'inaccessible' }
    : client_id
      ? { client_id, access_status: 'inaccessible' }
      : { referral_partner_id, access_status: 'inaccessible' };

  const { data: inaccessibleNotes = [] } = useQuery({
    queryKey: [...scopeKey, 'inaccessible-notes'],
    queryFn: () => base44.entities.MeetingNote.filter(notesFilter, '-meeting_date', 50),
    enabled: !!(lead_id || client_id || referral_partner_id),
  });

  // Key inaccessible notes by their calendar event so we can attach a warning
  // inline to the existing timeline row for that meeting instead of duplicating.
  const notesByEvent = useMemo(() => {
    const m = new Map();
    inaccessibleNotes.forEach(n => { if (n.event_id) m.set(n.event_id, n); });
    return m;
  }, [inaccessibleNotes]);

  const attachedEventIds = useMemo(() => {
    const s = new Set();
    for (const it of interactions) {
      if (it.calendar_event_id && notesByEvent.has(it.calendar_event_id)) s.add(it.calendar_event_id);
    }
    for (const ev of calendarEvents) {
      if (notesByEvent.has(ev.id)) s.add(ev.id);
    }
    return s;
  }, [interactions, calendarEvents, notesByEvent]);

  // Calendar events present as their own timeline row — a note attaches to the
  // calendar row preferentially, so don't also render it on a linked interaction row.
  const calendarEventIds = useMemo(() => new Set(calendarEvents.map(ev => ev.id)), [calendarEvents]);

  // Notes with no matching timeline row render as their own standalone rows.
  const standaloneNotes = useMemo(
    () => inaccessibleNotes.filter(n => n.event_id && !attachedEventIds.has(n.event_id)),
    [inaccessibleNotes, attachedEventIds]
  );

  const merged = useMemo(() => {
    const items = [
      ...interactions.map(it => ({ ...it, _type: 'interaction', _date: it.date })),
      ...emailLogs.map(e => ({ ...e, _type: 'email', _date: e.date })),
      ...calendarEvents.map(ev => ({ ...ev, _type: 'calendar', _date: ev.start_date })),
      ...standaloneNotes.map(n => ({ ...n, _type: 'note', _date: n.meeting_date })),
    ];
    return items.sort((a, b) => new Date(b._date) - new Date(a._date));
  }, [interactions, emailLogs, calendarEvents, standaloneNotes]);

  const [selectedEmail, setSelectedEmail] = useState(null);
  const { show: showSaved, trigger: triggerSaved } = useSaveBadge();

  const logMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const typeMap = { email: 'email', call: 'call', meeting: 'meeting', text: 'note', linkedin: 'note' };
      const label = CHANNEL_OPTIONS.find(c => c.value === channel)?.label || 'Touch';
      await base44.entities.ClientInteraction.create({
        channel,
        interaction_type: isContact ? (typeMap[channel] || 'note') : 'note',
        subject: note.trim() || (isContact ? `${label} touch` : 'Note'),
        notes: note.trim() || undefined,
        date: now,
        lead_id: lead_id || undefined,
        client_id: client_id || undefined,
        referral_partner_id: referral_partner_id || undefined,
      });
      if (isContact) {
        const today = new Date().toISOString().slice(0, 10);
        if (lead_id) {
          await base44.entities.Lead.update(lead_id, {
            last_contacted_date: today,
            outreach_channel: CHANNEL_TO_OUTREACH[channel] || 'other',
          });
        } else if (client_id) {
          await base44.entities.Client.update(client_id, { last_contacted_date: today });
        } else if (referral_partner_id) {
          await base44.entities.ReferralPartner.update(referral_partner_id, { last_contacted_date: today });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scopeKey });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      setNote('');
      setChannel('email');
      setIsContact(true);
      setShowForm(false);
      triggerSaved();
      if (onUpdate) onUpdate();
    },
  });

  const saveDisabled = logMutation.isPending || (!isContact && !note.trim());

  return (
    <div className="space-y-3">
      {showForm ? (
        <div className="bg-gray-50 border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Log a touch</span>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = channel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-navy'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {opt.label}
                </button>
              );
            })}
          </div>
          <Textarea
            placeholder="Note (optional)..."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="bg-white"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <Checkbox checked={isContact} onCheckedChange={v => setIsContact(v === true)} />
            This was a contact (updates last contacted date)
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-brand-green hover:bg-brand-forest gap-1.5"
              disabled={saveDisabled}
              onClick={() => logMutation.mutate()}
            >
              {logMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save
            </Button>
            <SaveBadge show={showSaved} />
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Log touch
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-6">Loading...</p>
      ) : merged.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">No activity logged yet.</p>
      ) : (
        <div className="space-y-2">
          {merged.map(item => {
            if (item._type === 'email') {
              const isOutbound = item.direction === 'outbound';
              return (
                <button
                  type="button"
                  key={`email-${item.id}`}
                  onClick={() => setSelectedEmail(item)}
                  className="w-full flex gap-3 bg-white border rounded-lg p-3 text-left hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isOutbound ? 'bg-blue-50' : 'bg-green-50'}`}>
                    {isOutbound ? <Send className="w-4 h-4 text-blue-500" /> : <Inbox className="w-4 h-4 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {item.subject || '(no subject)'}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{relDate(item.date)}</span>
                    </div>
                    {(item.snippet || item.body_preview) && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.snippet || item.body_preview}</p>
                    )}
                  </div>
                </button>
              );
            }
            if (item._type === 'calendar') {
              const isUpcoming = new Date(item.start_date) > new Date();
              return (
                <div
                  key={`cal-${item.id}`}
                  className={`flex gap-3 border rounded-lg p-3 ${isUpcoming ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-navy/10">
                    <Video className="w-4 h-4 text-brand-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                        {item.title || 'Untitled Event'}
                        {isUpcoming && (
                          <span className="text-xs text-blue-600 font-medium bg-blue-100 px-1.5 py-0.5 rounded">Upcoming</span>
                        )}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{calDate(item.start_date)}</span>
                    </div>
                    {item.meeting_link && (
                      <a
                        href={item.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-0.5"
                      >
                        Join meeting →
                      </a>
                    )}
                    {notesByEvent.has(item.id) && <NoteAccessWarning note={notesByEvent.get(item.id)} />}
                  </div>
                </div>
              );
            }
            if (item._type === 'note') {
              return (
                <div key={`note-${item.id}`} className="flex gap-3 bg-white border rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <FileWarning className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.meeting_title || 'Untitled meeting'}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{relDate(item.meeting_date)}</span>
                    </div>
                    <NoteAccessWarning note={item} />
                  </div>
                </div>
              );
            }
            const Icon = CHANNEL_ICONS[item.channel] || StickyNote;
            const isMeetingNotes = item.channel === 'meeting' && item.outcome && item.outcome.startsWith('http');
            return (
              <div key={item.id} className="flex gap-3 bg-white border rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.subject || item.interaction_type}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{relDate(item.date)}</span>
                  </div>
                  <EditableInteractionNote item={item} scopeKey={scopeKey} />
                  {isMeetingNotes ? (
                    <a href={item.outcome} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-0.5">
                      Open full notes →
                    </a>
                  ) : item.outcome ? (
                    <p className="text-xs text-green-600 mt-1">→ {item.outcome}</p>
                  ) : null}
                  {item.calendar_event_id && notesByEvent.has(item.calendar_event_id) && !calendarEventIds.has(item.calendar_event_id) && (
                    <NoteAccessWarning note={notesByEvent.get(item.calendar_event_id)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedEmail && (
        <FullEmailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
      )}
    </div>
  );
}