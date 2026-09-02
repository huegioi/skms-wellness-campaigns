import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin, User, FileText, Trash2, ExternalLink, Loader2, Edit, Upload, CheckCircle2, X, Send, ClipboardCheck, Video } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import FacilitationChecklist from '@/components/shared/FacilitationChecklist';
import CheckinQrDialog from '@/components/shared/CheckinQrDialog';
import { isChallengeEvent } from '@/lib/challengeUtils';
import { buildInviteDescription, icsEscape, icsFold } from '@/lib/calendarInviteBody';
import { resolveClientContact } from '@/lib/clientContacts';

export default function EventDetailDialog({ event, open, onOpenChange, eventTypeConfig, onUpdated }) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const { data: activePresenters = [] } = useQuery({
    queryKey: ['presenters-active'],
    queryFn: async () => {
      const all = await base44.entities.Presenter.list('name');
      return all.filter(p => p.is_active !== false);
    }
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteEmails, setInviteEmails] = useState({ client: event.client_email || '', presenter: event.presenter_email || '' });
  const [editForm, setEditForm] = useState({
    title: event.title,
    description: event.description || '',
    location: event.location || '',
    meeting_link: event.meeting_link || '',
    presenter: event.presenter || '',
    presenter_id: event.presenter_id || '',
    presenter_email: event.presenter_email || '',
    presenter_fee: event.presenter_fee ?? null,
    client_name: event.client_name || '',
    start_date: event.start_date?.split('T')[0] || '',
    start_time: event.start_date ? format(parseISO(event.start_date), 'HH:mm') : '',
    end_date: event.end_date?.split('T')[0] || '',
    end_time: event.end_date ? format(parseISO(event.end_date), 'HH:mm') : '',
    all_day: event.all_day || false
  });
  
  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
  const Icon = config.icon;

  const isChallenge = isChallengeEvent(event);
  const { data: assessmentCounts } = useQuery({
    queryKey: ['event-assessment-counts', event.id],
    queryFn: async () => {
      if (!event.client_id || !event.service_id) return null;
      const [day0, day14, cStart, cEnd] = await Promise.all([
        base44.entities.CohortAssessment.filter({ client_id: event.client_id, service_id: event.service_id, survey_type: 'challenge_day0' }, '-submitted_at', 500),
        base44.entities.CohortAssessment.filter({ client_id: event.client_id, service_id: event.service_id, survey_type: 'challenge_day14' }, '-submitted_at', 500),
        base44.entities.CohortAssessment.filter({ client_id: event.client_id, service_id: event.service_id, survey_type: 'cohort_start' }, '-submitted_at', 500),
        base44.entities.CohortAssessment.filter({ client_id: event.client_id, service_id: event.service_id, survey_type: 'cohort_end' }, '-submitted_at', 500),
      ]);
      return {
        day0: day0.length, day14: day14.length,
        baseline: isChallenge ? day0.length : cStart.length,
        endpoint: isChallenge ? day14.length : cEnd.length,
      };
    },
    enabled: !!event.client_id && !!event.service_id,
  });

  const { data: checkinCount = 0 } = useQuery({
    queryKey: ['event-checkins-detail', event.id],
    queryFn: async () => {
      const checkins = await base44.entities.EventCheckin.filter({ event_id: event.id });
      return checkins.length;
    },
    enabled: !!event.id,
  });

  // The client record behind this event, so the invite can greet the HUMAN at
  // the address we're mailing. `event.client_name` is the CLIENT — the
  // organization — and must never be used as a greeting name.
  const { data: inviteClient = null } = useQuery({
    queryKey: ['event_invite_client', event.client_id],
    queryFn: () => base44.entities.Client.get(event.client_id),
    enabled: !!event.client_id,
    staleTime: 60000,
  });

  const { data: service = null } = useQuery({
    queryKey: ['event-service', event.service_id],
    queryFn: async () => {
      if (!event.service_id) return null;
      const services = await base44.entities.Service.filter({ id: event.service_id });
      return services[0] || null;
    },
    enabled: !!event.service_id,
  });

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    setDeleting(true);
    try {
      // Delete from Google Calendar if synced
      if (event.google_event_id) {
        await base44.functions.invoke('syncCalendarEventToGoogle', {
          eventId: event.id,
          action: 'delete'
        });
      }
      
      await base44.entities.CalendarEvent.delete(event.id);
      toast.success('Event deleted');
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to delete event: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.title || !editForm.start_date) {
      toast.error('Please fill in the title and start date');
      return;
    }

    setSaving(true);
    try {
      const startDateTime = `${editForm.start_date}T${editForm.start_time || '00:00'}:00`;
      const endDateTime = editForm.end_date && editForm.end_time
        ? `${editForm.end_date}T${editForm.end_time}:00`
        : new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();

      const updatedData = {
        title: editForm.title,
        description: editForm.description,
        location: editForm.location,
        // Video link handed to attendees after check-in — any provider (Meet, Zoom, Teams).
        meeting_link: (editForm.meeting_link || '').trim() || null,
        presenter: editForm.presenter,
        presenter_id: editForm.presenter_id || null,
        presenter_email: editForm.presenter_email || '',
        presenter_fee: editForm.presenter_fee != null ? editForm.presenter_fee : null,
        client_name: editForm.client_name,
        start_date: startDateTime,
        end_date: endDateTime,
        all_day: editForm.all_day
      };

      // Update in CalendarEvent entity (automation will handle Google sync)
      await base44.entities.CalendarEvent.update(event.id, updatedData);

      toast.success('Event updated successfully');
      setEditing(false);
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update event: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const exportToGoogleCalendar = () => {
    const startDate = parseISO(event.start_date);
    const endDate = event.end_date ? parseISO(event.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const formatGoogleDate = (date) => format(date, "yyyyMMdd'T'HHmmss");
    
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', event.title);
    url.searchParams.set('dates', `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
    if (event.description) url.searchParams.set('details', event.description);
    if (event.location) url.searchParams.set('location', event.location);
    
    window.open(url.toString(), '_blank');
  };

  const exportToOutlook = () => {
    const startDate = parseISO(event.start_date);
    const endDate = event.end_date ? parseISO(event.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const url = new URL('https://outlook.office.com/calendar/0/deeplink/compose');
    url.searchParams.set('subject', event.title);
    url.searchParams.set('startdt', startDate.toISOString());
    url.searchParams.set('enddt', endDate.toISOString());
    if (event.description) url.searchParams.set('body', event.description);
    if (event.location) url.searchParams.set('location', event.location);
    
    window.open(url.toString(), '_blank');
  };

  const downloadICS = () => {
    const startDate = parseISO(event.start_date);
    const endDate = event.end_date ? parseISO(event.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const formatICSDate = (date) => format(date, "yyyyMMdd'T'HHmmss");
    
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SkillfulMeans//Calendar//EN',
      'BEGIN:VEVENT',
      icsFold(`DTSTART:${icsEscape(formatICSDate(startDate))}`),
      icsFold(`DTEND:${icsEscape(formatICSDate(endDate))}`),
      icsFold(`SUMMARY:${icsEscape(event.title)}`),
      icsFold(`DESCRIPTION:${icsEscape(buildInviteDescription(event, service))}`),
      icsFold(`LOCATION:${icsEscape(event.location || '')}`),
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    const icsContent = icsLines.join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncToGoogle = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncCalendarEventToGoogle', {
        eventId: event.id,
        action: 'sync'
      });

      if (response.data.success) {
        if (response.data.meetLink) {
          toast.success('Synced to Google Calendar — Meet room ready.', { description: 'The invite carries only the check-in link; attendees get the Meet after they check in.' });
        } else {
          toast.success('Synced to Google Calendar.', { description: 'Google did not return a Meet link. Try Add Meet link again in a moment.' });
        }
        if (response.data.strippedInviteMeet) {
          toast.info('Removed the Meet from the calendar invite.', { description: 'Attendees now see only the check-in link. The Meet room lives on a private holder event.' });
        }
        onUpdated?.();
      } else if (response.data.error) {
        toast.error('Failed to sync to Google Calendar: ' + response.data.error);
      }
    } catch (error) {
      toast.error('Failed to sync to Google Calendar: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleUnsyncFromGoogle = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncCalendarEventToGoogle', {
        eventId: event.id,
        action: 'unsync'
      });

      if (response.data.success) {
        toast.success('Event removed from Google Calendar');
        onUpdated?.();
      }
    } catch (error) {
      toast.error('Failed to unsync: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkComplete = async () => {
    setMarkingComplete(true);
    try {
      await base44.entities.CalendarEvent.update(event.id, {
        completed: true,
        completed_date: new Date().toISOString()
      });
      toast.success('Event marked as completed');
      try {
        const res = await base44.functions.invoke('autoAdvanceClientStage', { trigger: 'event_completed', event_id: event.id });
        if (res.data?.transitioned) {
          toast.success('Client stage → Program Delivery', {
            description: `${res.data.client_name} advanced from New Client Setup — first completed session.`,
          });
        }
      } catch { /* non-fatal */ }
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to mark as complete: ' + error.message);
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleMarkIncomplete = async () => {
    setMarkingComplete(true);
    try {
      await base44.entities.CalendarEvent.update(event.id, {
        completed: false,
        completed_date: null
      });
      toast.success('Event marked as incomplete');
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to mark as incomplete: ' + error.message);
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleSendInvite = async () => {
    // Emails and names must stay index-aligned, so build them as pairs — a blank
    // name is legitimate (we greet "Hi there,") and must not shift the array.
    const recipients = [
      inviteEmails.client
        ? {
            email: inviteEmails.client,
            name: resolveClientContact(inviteClient, inviteEmails.client).name || '',
          }
        : null,
      inviteEmails.presenter
        ? { email: inviteEmails.presenter, name: event.presenter || '' }
        : null,
    ].filter(Boolean);
    const emails = recipients.map(r => r.email);
    if (emails.length === 0) {
      toast.error('Please enter at least one email address');
      return;
    }
    setSendingInvite(true);
    try {
      const names = recipients.map(r => r.name);
      await base44.functions.invoke('sendCalendarInvite', {
        eventId: event.id,
        recipientEmails: emails,
        recipientNames: names
      });
      toast.success(`Calendar invite sent to ${emails.join(', ')}`);
      // Mark invite as sent on the event
      await base44.entities.CalendarEvent.update(event.id, { invite_sent: true });
      onUpdated?.();
    } catch (error) {
      toast.error('Failed to send invite: ' + error.message);
    } finally {
      setSendingInvite(false);
    }
  };

  return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: event.color || config.color }}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle>{editing ? 'Edit Event' : event.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge style={{ backgroundColor: event.color || config.color }} className="text-white">
                    {config.label}
                  </Badge>
                  {event.google_event_id && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Synced
                    </Badge>
                  )}
                  {event.completed && (
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>
        
        {editing ? (
          <div className="space-y-4 mt-4">
            <div>
              <Label>Event Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title"
              />
            </div>

            <div>
              <Label>Client Name</Label>
              <Input
                value={editForm.client_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Client name"
              />
            </div>

            <div>
              <Label>Presenter</Label>
              {activePresenters.length > 0 ? (
                <Select
                  value={editForm.presenter_id || 'none'}
                  onValueChange={(v) => {
                    const p = activePresenters.find(x => x.id === v);
                    setEditForm(prev => ({
                      ...prev,
                      presenter_id: v === 'none' ? '' : v,
                      presenter: p?.name || '',
                      // Carry the email too — notifications and Meet access both key off it.
                      presenter_email: p?.email || ''
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a presenter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No presenter</SelectItem>
                    {activePresenters.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.email ? ` — ${p.email}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={editForm.presenter}
                  onChange={(e) => setEditForm(prev => ({ ...prev, presenter: e.target.value }))}
                  placeholder="Presenter name"
                />
              )}
            </div>

            <div>
              <Label>Presenter Fee Override ($/session)</Label>
              <Input
                type="number"
                value={editForm.presenter_fee ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, presenter_fee: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="Leave blank to use presenter's default rate"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Event description..."
                rows={3}
              />
            </div>

            <div>
              <Label>Location</Label>
              <Input
                value={editForm.location}
                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Location or meeting link"
              />
            </div>

            <div>
              <Label>Video link (attendees are sent here after check-in)</Label>
              <Input
                type="url"
                value={editForm.meeting_link}
                onChange={(e) => setEditForm(prev => ({ ...prev, meeting_link: e.target.value }))}
                placeholder="https://zoom.us/j/…  ·  https://teams.microsoft.com/…  ·  https://meet.google.com/…"
              />
              <p className="text-xs text-gray-400 mt-1">Paste a Zoom, Teams, or Meet link. Leave blank to fall back to the Google Meet room created on sync.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                  disabled={editForm.all_day}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editForm.end_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                  disabled={editForm.all_day}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_all_day"
                checked={editForm.all_day}
                onChange={(e) => setEditForm(prev => ({ ...prev, all_day: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="edit_all_day" className="cursor-pointer">All-day event</Label>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="bg-[#264d44] hover:bg-[#1a3830]">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium">
                {format(parseISO(event.start_date), event.all_day ? 'EEEE, MMMM d, yyyy' : 'EEEE, MMMM d, yyyy')}
              </p>
              {!event.all_day && (
                <p className="text-sm text-gray-500">
                  {format(parseISO(event.start_date), 'h:mm a')}
                  {event.end_date && ` - ${format(parseISO(event.end_date), 'h:mm a')}`}
                </p>
              )}
              {event.all_day && <p className="text-sm text-gray-500">All day</p>}
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium">{event.location}</p>
                {event.location.startsWith('http') && (
                  <a href={event.location} target="_blank" rel="noopener noreferrer" className="text-sm text-[#013f7c] hover:underline">
                    {/\/Checkin\?/i.test(event.location) ? 'Open check-in page' : 'Join meeting'}
                  </a>
                )}
              </div>
            </div>
          )}

          {event.checkin_token && (
            <div className="flex items-start gap-3">
              <ClipboardCheck className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Attendee Check-in</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/Checkin?t=${event.checkin_token}`);
                      toast.success('Check-in link copied!');
                    }}
                    className="text-sm text-[#013f7c] hover:underline font-medium"
                  >
                    Copy check-in link
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => setShowQr(true)}
                    className="text-sm text-[#013f7c] hover:underline font-medium"
                  >
                    Show QR code
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/Checkin?t=${event.checkin_token}&kiosk=1`);
                      toast.success('Kiosk link copied!');
                    }}
                    className="text-sm text-[#013f7c] hover:underline font-medium"
                  >
                    Copy kiosk link
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Share this in the calendar invite instead of the raw video link. Kiosk link is for a tablet at the door.</p>
              </div>
            </div>
          )}

          {/* Video link — the link attendees are handed after check-in (Meet, Zoom, Teams, …) */}
          {(() => {
            const link = event.meeting_link || '';
            const provider = /meet\.google\.com/i.test(link) ? 'Google Meet'
              : /zoom\.(us|com)/i.test(link) ? 'Zoom'
              : /teams\.(microsoft|live)\.com/i.test(link) ? 'Microsoft Teams'
              : link ? 'Video link' : null;
            return (
            <div className="flex items-start gap-3">
              <Video className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{provider || 'Video link'} <span className="text-gray-400">· sent to attendees after check-in</span></p>
                {event.meeting_link ? (
                  <>
                    <a href={event.meeting_link} target="_blank" rel="noopener noreferrer" className="font-medium text-[#013f7c] hover:underline break-all">
                      {event.meeting_link.replace(/^https?:\/\//, '')}
                    </a>
                    <div className="flex items-center gap-3 mt-0.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(event.meeting_link);
                          toast.success('Link copied!');
                        }}
                        className="text-sm text-[#013f7c] hover:underline font-medium"
                      >
                        Copy link
                      </button>
                      <span className="text-gray-300">·</span>
                      <a href={event.meeting_link} target="_blank" rel="noopener noreferrer" className="text-sm text-[#013f7c] hover:underline font-medium">
                        Open
                      </a>
                      <span className="text-gray-300">·</span>
                      <button onClick={() => setEditing(true)} className="text-sm text-[#013f7c] hover:underline font-medium">
                        Change link
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Not on the calendar invite (that carries only the check-in link). Attendees get this automatically after they check in.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-amber-700">No video link on this event yet — attendees who check in will see "no video link".</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <button onClick={() => setEditing(true)} className="text-sm text-[#013f7c] hover:underline font-medium">
                        Paste a Zoom / Teams / Meet link
                      </button>
                      {event.google_event_id && (
                        <>
                          <span className="text-gray-300">·</span>
                          <button
                            onClick={handleSyncToGoogle}
                            disabled={syncing}
                            className="text-sm text-[#013f7c] hover:underline font-medium disabled:opacity-50"
                          >
                            {syncing ? 'Adding…' : 'Create a Google Meet room'}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })()}

          {event.client_name && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <p className="font-medium">{event.client_name}</p>
            </div>
          )}

          {event.presenter && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Presenter</p>
                <p className="font-medium">{event.presenter}</p>
                {event.presenter_email && (
                  <p className="text-xs text-gray-500 break-all">{event.presenter_email}</p>
                )}

                {event.presenter_notified_at ? (
                  <div className="mt-1">
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Notified {format(parseISO(event.presenter_notified_at), 'MMM d')} at {format(parseISO(event.presenter_notified_at), 'h:mm a')}
                      {event.presenter_notified_email && event.presenter_notified_email !== event.presenter_email
                        ? ` · sent to ${event.presenter_notified_email}`
                        : ''}
                    </p>
                    <button
                      onClick={() => openNotifyPreview()}
                      disabled={notifying}
                      className="text-sm text-[#013f7c] hover:underline font-medium disabled:opacity-50 mt-0.5"
                    >
                      Send again
                    </button>
                  </div>
                ) : (
                  <div className="mt-1">
                    {event.presenter_notify_status === 'failed' && (
                      <p className="text-xs text-red-700 mb-0.5">
                        Last attempt failed{event.presenter_notify_error ? ` — ${event.presenter_notify_error}` : ''}
                      </p>
                    )}
                    <button
                      onClick={() => openNotifyPreview()}
                      disabled={notifying}
                      className="text-sm text-[#013f7c] hover:underline font-medium disabled:opacity-50"
                    >
                      {notifying ? 'Preparing…' : 'Notify presenter'}
                    </button>
                    <span className="text-xs text-gray-400 ml-2">Nothing sends until you confirm</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {event.proposal_id && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
              <Link to={createPageUrl('EditProposal') + `?id=${event.proposal_id}`} className="text-[#013f7c] hover:underline">
                View Related Proposal
              </Link>
            </div>
          )}

          {event.description && (
            <div className="pt-3 border-t">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Facilitation checklist (challenge events) */}
          {isChallenge && (
            <div className="pt-3 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <ClipboardCheck className="w-4 h-4" /> Facilitation Progress
              </p>
              <FacilitationChecklist
                day0Count={assessmentCounts?.day0 ?? 0}
                day14Count={assessmentCounts?.day14 ?? 0}
                checkinCount={checkinCount}
                hasRecording={!!event.recording_link}
                compact
              />
            </div>
          )}
          {/* Facilitation checklist (non-challenge events with assessment_timing) */}
          {!isChallenge && event.assessment_timing && event.assessment_timing !== 'none' && (
            <div className="pt-3 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <ClipboardCheck className="w-4 h-4" /> Assessment Progress
              </p>
              <FacilitationChecklist
                baselineCount={assessmentCounts?.baseline ?? 0}
                endpointCount={assessmentCounts?.endpoint ?? 0}
                checkinCount={checkinCount}
                hasRecording={!!event.recording_link}
                compact
              />
            </div>
          )}

          {/* Sync to Google Calendar */}
          <div className="pt-3 border-t">
            {event.google_event_id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Synced to Google Calendar{event.meeting_link ? ' · Meet room ready' : ''}</span>
                </div>
                <Button 
                  onClick={handleUnsyncFromGoogle} 
                  disabled={syncing}
                  variant="outline"
                  className="w-full"
                >
                  {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {syncing ? 'Removing...' : 'Remove from Google Calendar'}
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleSyncToGoogle} 
                disabled={syncing}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {syncing ? 'Syncing...' : 'Sync to Google Calendar + create Meet room'}
              </Button>
            )}
          </div>

          {/* Send Calendar Invite */}
          <div className="pt-3 border-t">
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Send className="w-4 h-4" /> Send Calendar Invite</p>
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Client email"
                value={inviteEmails.client}
                onChange={(e) => setInviteEmails(prev => ({ ...prev, client: e.target.value }))}
              />
              <Input
                type="email"
                placeholder="Presenter email"
                value={inviteEmails.presenter}
                onChange={(e) => setInviteEmails(prev => ({ ...prev, presenter: e.target.value }))}
              />
              <Button
                onClick={handleSendInvite}
                disabled={sendingInvite}
                className="w-full bg-[#013f7c] hover:bg-[#012d5a]"
              >
                {sendingInvite ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {sendingInvite ? 'Sending...' : 'Send Invite by Email'}
              </Button>
            </div>
          </div>

          {/* Export Options */}
          <div className="pt-3 border-t">
            <p className="text-sm font-medium text-gray-600 mb-2">Add to Other Calendars:</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportToGoogleCalendar}>
                <ExternalLink className="w-3 h-3 mr-1" /> Google
              </Button>
              <Button variant="outline" size="sm" onClick={exportToOutlook}>
                <ExternalLink className="w-3 h-3 mr-1" /> Outlook
              </Button>
              <Button variant="outline" size="sm" onClick={downloadICS}>
                <ExternalLink className="w-3 h-3 mr-1" /> Download .ics
              </Button>
            </div>
          </div>

            <div className="pt-3 border-t flex flex-col sm:flex-row justify-between gap-2">
              {!event.completed ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMarkComplete} 
                  disabled={markingComplete}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                >
                  {markingComplete ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  Mark as Completed
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMarkIncomplete} 
                  disabled={markingComplete}
                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                >
                  {markingComplete ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                  Mark as Incomplete
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete Event
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
      {event.checkin_token && (
        <CheckinQrDialog
          open={showQr}
          onOpenChange={setShowQr}
          checkinUrl={`${window.location.origin}/Checkin?t=${event.checkin_token}`}
          eventTitle={event.title}
          eventDate={event.start_date}
        />
      )}
    </Dialog>
  );
}