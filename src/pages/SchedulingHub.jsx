import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Calendar, Clock, MapPin, Users, ExternalLink, Plus, Pencil, Check, X, FileText, FileSpreadsheet, CheckCircle2, LayoutGrid, List, Filter } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DemoBadge } from '@/components/shared/DemoBadge';
import MonthlyCalendar from '@/components/scheduling/MonthlyCalendar';
import WeeklyCalendar from '@/components/scheduling/WeeklyCalendar';
import CompanySearch from '@/components/scheduling/CompanySearch';
import ScheduleChecklist from '@/components/scheduling/ScheduleChecklist';
import EventDetailDialog from '@/components/calendar/EventDetailDialog';
import FacilitationChecklist from '@/components/shared/FacilitationChecklist';
import DeliveryEventRow from '@/components/scheduling/DeliveryEventRow';
import MeetingsEventRow from '@/components/scheduling/MeetingsEventRow';
import { getEventSourceBadge, getEventLens } from '@/components/scheduling/eventLenses';
import { isChallengeEvent, getChallengeDayProgress } from '@/lib/challengeUtils';
import MeetingNotesReviewCard from '@/components/scheduling/MeetingNotesReviewCard';
import SurveySendsCard from '@/components/scheduling/SurveySendsCard';
import { computeSmartAssessmentTiming } from '@/lib/checkinAssessmentUtils';
import ProposalPicker from '@/components/proposals/ProposalPicker';
import { getProposalServiceItems, getProposalParty } from '@/lib/proposalFulfillment';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export default function SchedulingHub() {
  const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [bookServiceDialogOpen, setBookServiceDialogOpen] = useState(false);
  const [bookingSource, setBookingSource] = useState('invoice'); // 'invoice' | 'proposal'
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [selectedLineItem, setSelectedLineItem] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    title: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location: '',
    client_name: '',
    client_id: '',
    client_email: '',
    service_id: '',
    presenter: '',
    presenter_id: '',
    presenter_email: '',
    source: '',
    all_day: false,
    assessment_timing: 'none'
  });

  const { data: activePresenters = [] } = useQuery({
    queryKey: ['presenters-active'],
    queryFn: async () => {
      const all = await base44.entities.Presenter.list('name');
      return all.filter(p => p.is_active !== false);
    }
  });

  const [selectedEvent, setSelectedEvent] = useState(null);

  // Deep-link checklist (from pipeline card / detail view)
  const urlParams = new URLSearchParams(window.location.search);
  const [checklistClientId, setChecklistClientId] = useState(urlParams.get('clientId') || '');
  const [checklistProposalId, setChecklistProposalId] = useState(urlParams.get('proposalId') || '');
  const closeChecklist = () => {
    setChecklistClientId('');
    setChecklistProposalId('');
    window.history.replaceState({}, '', window.location.pathname);
  };
  // Deep-link: open Book Service with a proposal (+ service) preselected — from the
  // proposal fulfillment card — or open one event's detail (?eventId=).
  const [pendingBook, setPendingBook] = useState(() => {
    const pid = urlParams.get('bookProposalId');
    return pid ? { proposalId: pid, serviceId: urlParams.get('bookServiceId') || '' } : null;
  });
  const [pendingEventId, setPendingEventId] = useState(urlParams.get('eventId') || '');
  const [addingToCalendar, setAddingToCalendar] = useState(null);
  const [calendarView, setCalendarView] = useState('week'); // 'month', 'week', 'list'
  const [eventLens, setEventLens] = useState('delivery'); // 'delivery' | 'meetings'
  const [filterType, setFilterType] = useState('all');
  const [filterPresenter, setFilterPresenter] = useState('all');
  const [eventRange, setEventRange] = useState('30');   // days forward
  const [showDemo, setShowDemo] = useState(false);      // demo events hidden by default
  const queryClient = useQueryClient();

  const eventTypeConfig = {
    meeting: { label: 'Meeting', color: '#3B82F6', icon: Calendar },
    workshop: { label: 'Workshop', color: '#8B5CF6', icon: Calendar },
    challenge: { label: 'Challenge', color: '#10B981', icon: Calendar },
    leadership: { label: 'Leadership', color: '#F59E0B', icon: Calendar },
    presentation: { label: 'Presentation', color: '#770142', icon: Calendar },
    class: { label: 'Class', color: '#EC4899', icon: Calendar },
    delivery: { label: 'Delivery', color: '#06B6D4', icon: Calendar },
    follow_up: { label: 'Follow Up', color: '#14B8A6', icon: Calendar },
    other: { label: 'Other', color: '#264d44', icon: Calendar }
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schedule', SPREADSHEET_ID],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncGoogleSheets', {});
      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date')
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date')
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ['services-active'],
    queryFn: () => base44.entities.Service.filter({ is_active: true }, 'name')
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => base44.entities.Client.list('name', 500)
  });

  const { data: calendarEvents = [], refetch: refetchCalendarEvents } = useQuery({
    queryKey: ['calendarEvents', eventRange],
    queryFn: () => base44.entities.CalendarEvent.list('start_date', 1000)
  });

  // Mirror sheet rows into CalendarEvent records (auto-runs on mount + every 5 min)
  const { data: mirrorResult } = useQuery({
    queryKey: ['mirrorSheetEvents'],
    queryFn: async () => {
      const response = await base44.functions.invoke('mirrorSheetEvents', { window_days: 365 });
      return response.data;
    },
    refetchInterval: 300000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (mirrorResult?.success) {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
    }
  }, [mirrorResult, queryClient]);

  const { data: cohortAssessments = [] } = useQuery({
    queryKey: ['cohort-assessments-all'],
    queryFn: async () => {
      const [day0, day14, cStart, cEnd, sessionChecks] = await Promise.all([
        base44.entities.CohortAssessment.filter({ survey_type: 'challenge_day0' }, '-submitted_at', 500),
        base44.entities.CohortAssessment.filter({ survey_type: 'challenge_day14' }, '-submitted_at', 500),
        base44.entities.CohortAssessment.filter({ survey_type: 'cohort_start' }, '-submitted_at', 500),
        base44.entities.CohortAssessment.filter({ survey_type: 'cohort_end' }, '-submitted_at', 500),
        base44.entities.CohortAssessment.filter({ survey_type: 'session_check' }, '-submitted_at', 500),
      ]);
      return [...day0, ...day14, ...cStart, ...cEnd, ...sessionChecks];
    },
  });

  // Build assessment count map keyed by event_id|survey_type — scoped to THIS
  // event's check-ins so the "N of M checked in" numerator never exceeds the
  // event's own check-in count (fixes the misleading "14 of 3" reading).
  const eventAssessmentCountMap = {};
  for (const a of cohortAssessments) {
    if (!a.event_id) continue;
    const key = `${a.event_id}|${a.survey_type}`;
    eventAssessmentCountMap[key] = (eventAssessmentCountMap[key] || 0) + 1;
  }
  const getEventAssessmentCounts = (event) => {
    if (!event.id) return { day0: 0, day14: 0, baseline: 0, endpoint: 0, session: 0 };
    return {
      day0: eventAssessmentCountMap[`${event.id}|challenge_day0`] || 0,
      day14: eventAssessmentCountMap[`${event.id}|challenge_day14`] || 0,
      baseline: eventAssessmentCountMap[`${event.id}|cohort_start`] || 0,
      endpoint: eventAssessmentCountMap[`${event.id}|cohort_end`] || 0,
      session: eventAssessmentCountMap[`${event.id}|session_check`] || 0,
    };
  };

  const bookServiceMutation = useMutation({
    mutationFn: async (eventData) => {
      const startDateTime = `${eventData.start_date}T${eventData.start_time || '09:00'}:00`;
      const endDateTime = eventData.end_date && eventData.end_time 
        ? `${eventData.end_date}T${eventData.end_time}:00`
        : new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();

      // Resolve client_id from proposal if available
      let resolvedClientId = '';
      if (eventData.proposal_id) {
        const proposal = proposals.find(p => p.id === eventData.proposal_id);
        resolvedClientId = proposal?.client_id || '';
      }

      // Derive event_type from service category (challenge, workshop, etc.)
      const matchedService = eventData.service_id ? allServices.find(s => s.id === eventData.service_id) : null;
      const derivedEventType = matchedService && ['workshop', 'challenge', 'leadership', 'class'].includes(matchedService.category)
        ? matchedService.category
        : 'other';

      // Auto-tag is_demo when the linked client is a demo client.
      const linkedClientId = eventData.client_id || resolvedClientId;
      const linkedClient = linkedClientId ? allClients.find(c => c.id === linkedClientId) : null;

      // Create event in CalendarEvent entity only
      const calendarEvent = await base44.entities.CalendarEvent.create({
        title: eventData.title,
        description: eventData.description || '',
        location: eventData.location || '',
        start_date: startDateTime,
        end_date: endDateTime,
        all_day: eventData.all_day,
        event_type: derivedEventType,
        client_name: eventData.client_name || '',
        client_id: linkedClientId,
        service_id: eventData.service_id || null,
        presenter: eventData.presenter || '',
        presenter_id: eventData.presenter_id || null,
        presenter_email: eventData.presenter_email || '',
        proposal_id: eventData.proposal_id || '',
        assessment_timing: eventData.assessment_timing || 'none',
        checkin_token: crypto.randomUUID(),
        color: '#264d44',
        is_demo: linkedClient?.is_demo === true,
      });

      // Booking = one step: push to Google Calendar (creates the Meet room and stores
      // meeting_link) right away. Demo events never sync. A failure here is non-fatal —
      // the event exists and the dialog's Sync button retries the same function.
      let sync = { status: 'skipped' };
      if (!calendarEvent.is_demo) {
        try {
          const res = await base44.functions.invoke('syncCalendarEventToGoogle', {
            eventId: calendarEvent.id,
            action: 'sync',
          });
          sync = res.data?.success
            ? { status: 'synced', meetLink: res.data.meetLink || null }
            : { status: 'failed', error: res.data?.error || 'unknown error' };
        } catch (e) {
          sync = { status: 'failed', error: e.message };
        }
      }

      return { calendarEvent, sync };
    },
    onSuccess: ({ sync }) => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-events'] });     // client-card chip
      queryClient.invalidateQueries({ queryKey: ['fulfillment-events'] });  // proposal fulfillment card
      if (sync.status === 'synced' && sync.meetLink) {
        toast.success('Booked — added to Google Calendar, Meet room ready.', { description: 'The invite carries only the check-in link; attendees get the Meet after they check in.' });
      } else if (sync.status === 'synced') {
        toast.success('Booked — added to Google Calendar.', { description: 'No Meet link came back; open the event and click Sync to add one.' });
      } else if (sync.status === 'failed') {
        toast.warning('Booked, but Google Calendar sync failed.', { description: `${sync.error} — open the event and click Sync to Google to retry.` });
      } else {
        toast.success('Service booked successfully!');
      }
      setBookServiceDialogOpen(false);
      resetBookingForm();
    },
    onError: (error) => {
      toast.error('Failed to book service: ' + error.message);
    }
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['mirrorSheetEvents'] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCellEdit = (sheetName, rowIndex, columnIndex, currentValue, headerRowIndex) => {
    setEditingCell({ sheetName, rowIndex, columnIndex, headerRowIndex });
    setEditValue(currentValue || '');
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    try {
      const response = await base44.functions.invoke('syncGoogleSheets', {
        action: 'update',
        sheetName: editingCell.sheetName,
        rowIndex: editingCell.rowIndex,
        columnIndex: editingCell.columnIndex,
        value: editValue,
        headerRowIndex: editingCell.headerRowIndex
      });

      if (response.data.success) {
        queryClient.invalidateQueries({ queryKey: ['schedule', SPREADSHEET_ID] });
        setEditingCell(null);
        setEditValue('');
      }
    } catch (error) {
      alert('Failed to save changes: ' + error.message);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Range-filtered list for the All Events list view (forward/past window).
  // Declared before early returns so the useMemo hook order stays stable.
  const rangeFilteredEvents = useMemo(() => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const filtered = (calendarEvents || []).filter(event => {
      if (!showDemo && event.is_demo) return false;
      const typeMatch = filterType === 'all' || event.event_type === filterType;
      const presenterMatch = filterPresenter === 'all' || event.presenter === filterPresenter;
      return typeMatch && presenterMatch;
    });
    if (eventRange === 'past') {
      return filtered
        .filter(e => parseISO(e.start_date) < startToday)
        .sort((a, b) => parseISO(b.start_date) - parseISO(a.start_date)); // newest first
    }
    if (eventRange === 'all') {
      return filtered
        .filter(e => parseISO(e.start_date) >= startToday)
        .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date)); // soonest first
    }
    const days = parseInt(eventRange, 10) || 30;
    const endWindow = new Date(startToday);
    endWindow.setDate(endWindow.getDate() + days);
    return filtered
      .filter(e => {
        const d = parseISO(e.start_date);
        return d >= startToday && d < endWindow;
      })
      .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date)); // soonest first
  }, [calendarEvents, filterType, filterPresenter, eventRange]);

  // Apply ?bookProposalId=&bookServiceId= once the data it needs has loaded
  // NOTE: must sit ABOVE the isLoading/error early returns (hook order), and must not
  // run until the page has rendered past them — the handlers it calls are consts below.
  useEffect(() => {
    if (isLoading || error) return;
    if (!pendingBook || proposals.length === 0) return;
    const proposal = proposals.find(p => p.id === pendingBook.proposalId);
    if (!proposal) { setPendingBook(null); return; }
    setBookingSource('proposal');
    setSelectedInvoiceId('');
    setBookServiceDialogOpen(true);
    handleProposalSelect(proposal.id);
    if (pendingBook.serviceId) {
      const svc = getProposalServiceItems(proposal, allServices).find(i => i.service_id === pendingBook.serviceId);
      if (svc) {
        handleProposalServiceSelect(svc, proposal);
      }
    }
    setPendingBook(null);
    window.history.replaceState({}, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBook, proposals, allServices, allClients, isLoading, error]);

  // Apply ?eventId= — open that event's detail dialog
  useEffect(() => {
    if (isLoading || error) return;
    if (!pendingEventId || calendarEvents.length === 0) return;
    const ev = calendarEvents.find(e => e.id === pendingEventId);
    if (ev) setSelectedEvent(ev);
    setPendingEventId('');
    window.history.replaceState({}, '', window.location.pathname);
  }, [pendingEventId, calendarEvents, isLoading, error]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#013f7c' }} />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Schedule</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <Button onClick={handleManualRefresh}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  const sheets = data?.sheets || [];
  const spreadsheetTitle = data?.title || 'Scheduling Hub';

  // Sheet events are now mirrored into CalendarEvent records by the mirrorSheetEvents backend function.
  // The Coming Up list shows CalendarEvent records only — no more raw parsed sheet rows.

  // Get upcoming CalendarEvent entities (next 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  
  // Get unique presenters for filter
  const allPresenters = [...new Set(calendarEvents
    .filter(e => e.presenter)
    .map(e => e.presenter)
  )];
  
  // Filter events based on selected filters (demo events hidden unless toggle is on)
  const filteredCalendarEvents = (calendarEvents || [])
    .filter(event => {
      if (!showDemo && event.is_demo) return false;
      const typeMatch = filterType === 'all' || event.event_type === filterType;
      const presenterMatch = filterPresenter === 'all' || event.presenter === filterPresenter;
      return typeMatch && presenterMatch;
    });
  
  const upcomingCalendarEvents = filteredCalendarEvents
    .filter(event => {
      const eventDate = parseISO(event.start_date);
      return eventDate >= startOfToday && eventDate <= thirtyDaysFromNow;
    })
    .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date));

  // All upcoming events are CalendarEvent records (sheet-mirrored events have source_calendar='sheet')
  const combinedUpcomingEvents = upcomingCalendarEvents
    .map(event => ({
      ...event,
      source: 'calendar',
      date: parseISO(event.start_date),
      isPast: parseISO(event.start_date) < now
    }))
    .sort((a, b) => a.date - b.date);

  // Split into Delivery and Meetings lenses
  const enrichedEvents = combinedUpcomingEvents.map(event => ({
    ...event,
    sourceBadge: getEventSourceBadge(event),
    lens: getEventLens(event),
  }));
  const deliveryEvents = enrichedEvents.filter(e => e.lens === 'delivery').sort((a, b) => {
    // Declined sessions (presenter_declined_at set, no current presenter) sort to top
    const aDeclined = (!a.presenter_id && a.presenter_declined_at) ? 0 : 1;
    const bDeclined = (!b.presenter_id && b.presenter_declined_at) ? 0 : 1;
    if (aDeclined !== bDeclined) return aDeclined - bDeclined;
    return a.date - b.date;
  });
  const meetingEvents = enrichedEvents.filter(e => e.lens === 'meetings');
  const lensEvents = eventLens === 'delivery' ? deliveryEvents : meetingEvents;

  const handleMoveLens = async (event, targetLens) => {
    const newType = targetLens === 'delivery' ? 'workshop' : 'meeting';
    try {
      await base44.entities.CalendarEvent.update(event.id, { event_type: newType });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      toast.success(`Moved to ${targetLens === 'delivery' ? 'Delivery' : 'Meetings'}`);
    } catch (e) {
      toast.error('Failed to move event: ' + e.message);
    }
  };

  const addSheetEventToAppCalendar = async (event) => {
    setAddingToCalendar(event.title);
    try {
      // Validate required fields
      if (!event.title || event.title.trim() === '') {
        throw new Error('Event title is required');
      }

      if (!event.date || isNaN(new Date(event.date).getTime())) {
        throw new Error('Invalid event date');
      }

      // Check if event already exists
      const existingEvents = await base44.entities.CalendarEvent.filter({ 
        title: event.title, 
        client_name: event.client 
      });
      
      if (existingEvents.length > 0) {
        const existingDate = new Date(existingEvents[0].start_date).toLocaleDateString();
        const newDate = new Date(event.date).toLocaleDateString();
        if (existingDate === newDate) {
          toast.error('This event already exists in the calendar');
          setAddingToCalendar(null);
          return;
        }
      }

      // Parse the date and set time in America/New_York timezone
      const startDate = new Date(event.date);

      // If there's a time string, parse it
      if (event.time && event.time.trim() !== '') {
        const timeParts = event.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeParts) {
          let hours = parseInt(timeParts[1]);
          const minutes = parseInt(timeParts[2]);
          const period = timeParts[3];

          if (period && period.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
          } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
          }

          startDate.setHours(hours, minutes, 0, 0);
        }
      } else {
        // Default to 8 AM for challenges, 9 AM for everything else
        const isChallenge = event.sheet?.toLowerCase().includes('challenge');
        startDate.setHours(isChallenge ? 8 : 9, 0, 0, 0);
      }

      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);

      let description = `Client: ${event.client || 'N/A'}\nSource: ${event.sheet}`;
      if (event.linkToHost) description += `\nLink to Host Video: ${event.linkToHost}`;
      if (event.recording) description += `\nRecording: ${event.recording}`;
      if (event.translation) description += `\nTranslation: ${event.translation}`;

      // Format as ISO string but treat as local time (America/New_York)
      const formatLocalAsISO = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:00`;
      };

      await base44.entities.CalendarEvent.create({
        title: event.title,
        description,
        location: event.location || '',
        start_date: formatLocalAsISO(startDate),
        end_date: formatLocalAsISO(endDate),
        all_day: false,
        event_type: 'other',
        client_name: event.client || '',
        presenter: event.presenter || '',
        checkin_token: crypto.randomUUID(),
        color: '#264d44'
      });

      toast.success('Event added to app calendar!');
      refetchCalendarEvents();
    } catch (error) {
      console.error('Error adding event:', error);
      toast.error(error.message || 'Failed to add event');
    } finally {
      setAddingToCalendar(null);
    }
  };

  const handleInvoiceSelect = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    setSelectedLineItem(null);
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      const clientName = invoice.client_name || invoice.company || '';
      const matchedClient = allClients.find(c =>
        (c.name || '').toLowerCase() === clientName.toLowerCase() ||
        (c.company || '').toLowerCase() === clientName.toLowerCase()
      );
      setBookingForm(prev => ({
        ...prev,
        client_name: clientName,
        client_id: invoice.client_id || matchedClient?.id || '',
        client_email: matchedClient?.email || prev.client_email,
      }));
    }
  };

  const handleProposalSelect = (proposalId) => {
    setSelectedProposalId(proposalId);
    setSelectedLineItem(null);
    const proposal = proposals.find(p => p.id === proposalId);
    if (proposal) {
      const party = getProposalParty(proposal, allClients);
      // Older proposals have no client_id — fall back to matching a Client record by
      // company / name / email so the Client field is pre-filled instead of "No client linked".
      let clientId = proposal.client_id || '';
      if (!clientId) {
        const norm = (s) => (s || '').trim().toLowerCase();
        const candidates = [proposal.company, proposal.client_name].map(norm).filter(Boolean);
        const email = norm(proposal.client_email);
        const match = allClients.find(c =>
          (email && norm(c.email) === email) ||
          candidates.includes(norm(c.company)) ||
          candidates.includes(norm(c.name))
        );
        clientId = match?.id || '';
      }
      const matchedClient = clientId ? allClients.find(c => c.id === clientId) : null;
      setBookingForm(prev => ({
        ...prev,
        client_name: matchedClient?.company || party.company || proposal.client_name || proposal.company || '',
        client_id: clientId,
        client_email: matchedClient?.email || party.email || prev.client_email,
      }));
    }
  };

  // Shared extractor (lib/proposalFulfillment) — same list the fulfillment card shows.
  const getProposalServices = (proposal) => getProposalServiceItems(proposal, allServices);

  const handleLineItemSelect = (lineItem) => {
    setSelectedLineItem(lineItem);
    const itemName = lineItem.description || lineItem.name || '';
    const matchedService = allServices.find(s =>
      (s.name || '').toLowerCase() === itemName.toLowerCase()
    );
    const serviceName = matchedService?.name || itemName;
    const client = bookingForm.client_id ? allClients.find(c => c.id === bookingForm.client_id) : null;
    const company = client?.company || bookingForm.client_name || '';
    setBookingForm(prev => ({
      ...prev,
      title: company ? `${serviceName} — ${company}` : serviceName,
      service_id: lineItem.service_id || matchedService?.id || '',
      description: lineItem.description ? `Service from invoice\n\nQuantity: ${lineItem.quantity || 1}\nRate: $${lineItem.rate || 0}` : ''
    }));
  };

  const handleProposalServiceSelect = (svc, proposalOverride = null) => {
    setSelectedLineItem(svc);
    const matchedService = allServices.find(s =>
      (s.name || '').toLowerCase() === (svc.name || '').toLowerCase()
    );
    const serviceName = svc.service_id ? (allServices.find(s => s.id === svc.service_id)?.name || svc.name) : (matchedService?.name || svc.name);
    // proposalOverride: used by the deep-link path, where bookingForm state isn't populated yet
    const clientId = proposalOverride?.client_id || bookingForm.client_id;
    const client = clientId ? allClients.find(c => c.id === clientId) : null;
    const company = client?.company || (proposalOverride ? getProposalParty(proposalOverride, allClients).company : '') || bookingForm.client_name || '';
    setBookingForm(prev => ({
      ...prev,
      title: company ? `${serviceName} — ${company}` : serviceName,
      service_id: svc.service_id || matchedService?.id || '',
      description: svc.description || ''
    }));
  };

  const resetBookingForm = () => {
    setSelectedInvoiceId('');
    setSelectedProposalId('');
    setSelectedLineItem(null);
    setBookingForm({
      title: '',
      description: '',
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      location: '',
      client_name: '',
      client_id: '',
      client_email: '',
      service_id: '',
      presenter: '',
      presenter_id: '',
      presenter_email: '',
      source: '',
      all_day: false,
      assessment_timing: 'none'
    });
  };

  const handleBookService = () => {
    if (!bookingForm.title || !bookingForm.start_date) {
      toast.error('Please fill in the service name and start date');
      return;
    }
    const proposal = proposals.find(p => p.id === selectedProposalId);
    bookServiceMutation.mutate({
      ...bookingForm,
      proposal_id: selectedProposalId || '',
      source: bookingSource === 'proposal' ? (proposal?.client_name || 'Proposal') : (selectedInvoice?.invoice_number || 'Invoice')
    });
  };

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-3 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-7 h-7" style={{ color: '#013f7c' }} />
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#013f7c' }}>
                Scheduling Hub
              </h1>
            </div>
            <p className="text-gray-600 text-sm">
              Real-time sync with Google Sheets • Auto-updates every 30 seconds
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setBookServiceDialogOpen(true)}
              className="bg-[#770142] hover:bg-[#5a0132]"
              size="sm"
            >
              <FileText className="w-4 h-4 mr-2" />
              Book Service
            </Button>
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              disabled={isRefreshing}
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#264d44] hover:bg-[#1a3830]" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Sheet
              </Button>
            </a>
          </div>
        </div>

        <MeetingNotesReviewCard />

        {/* Deep-link To-Schedule Checklist */}
        {checklistClientId && (
          <ScheduleChecklist
            clientId={checklistClientId}
            proposalId={checklistProposalId}
            proposals={proposals}
            calendarEvents={calendarEvents}
            allServices={allServices}
            allClients={allClients}
            onClose={closeChecklist}
          />
        )}

        {/* Coming Up Section - with Delivery/Meetings lens toggle */}
        {combinedUpcomingEvents.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#013f7c' }}>
                  <Clock className="w-5 h-5" />
                  Coming Up (Next 30 Days)
                </h2>
                <div className="flex gap-1 border rounded-lg p-1 bg-white">
                  <button
                    onClick={() => setEventLens('delivery')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      eventLens === 'delivery' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Delivery ({deliveryEvents.length})
                  </button>
                  <button
                    onClick={() => setEventLens('meetings')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      eventLens === 'meetings' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Meetings ({meetingEvents.length})
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {lensEvents.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No {eventLens === 'delivery' ? 'deliveries' : 'meetings'} coming up.
                  </p>
                ) : eventLens === 'delivery' ? (
                  lensEvents.slice(0, 10).map((event, idx) => (
                    <DeliveryEventRow
                      key={event.source === 'calendar' ? event.id : `sheet-${idx}`}
                      event={event}
                      allServices={allServices}
                      getEventAssessmentCounts={getEventAssessmentCounts}
                      onSelectEvent={setSelectedEvent}
                      onAddToCalendar={addSheetEventToAppCalendar}
                      addingToCalendar={addingToCalendar}
                      onMoveLens={handleMoveLens}
                    />
                  ))
                ) : (
                  lensEvents.slice(0, 10).map((event, idx) => (
                    <MeetingsEventRow
                      key={event.id || `meeting-${idx}`}
                      event={event}
                      onSelectEvent={setSelectedEvent}
                      onMoveLens={handleMoveLens}
                    />
                  ))
                )}
              </div>
              {lensEvents.length > 10 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  +{lensEvents.length - 10} more event{lensEvents.length - 10 !== 1 ? 's' : ''} coming up
                </p>
              )}
            </div>
          </Card>
        )}



        {/* Calendar View Controls */}
        <Card className="mb-6 p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold text-gray-700 text-sm">View:</h3>
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={calendarView === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCalendarView('month')}
                  className={calendarView === 'month' ? 'bg-[#264d44] hover:bg-[#1a3830]' : ''}
                >
                  <LayoutGrid className="w-4 h-4 mr-1" />
                  Month
                </Button>
                <Button
                  variant={calendarView === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCalendarView('week')}
                  className={calendarView === 'week' ? 'bg-[#264d44] hover:bg-[#1a3830]' : ''}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Week
                </Button>
                <Button
                  variant={calendarView === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCalendarView('list')}
                  className={calendarView === 'list' ? 'bg-[#264d44] hover:bg-[#1a3830]' : ''}
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="challenge">Challenge</SelectItem>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {allPresenters.length > 0 && (
                <Select value={filterPresenter} onValueChange={setFilterPresenter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Presenter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Presenters</SelectItem>
                    {allPresenters.map(presenter => (
                      <SelectItem key={presenter} value={presenter}>
                        {presenter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {calendarView === 'list' && (
                <Select value={eventRange} onValueChange={setEventRange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Next 7 days</SelectItem>
                    <SelectItem value="30">Next 30 days</SelectItem>
                    <SelectItem value="90">Next 90 days</SelectItem>
                    <SelectItem value="180">Next 6 months</SelectItem>
                    <SelectItem value="365">Next 12 months</SelectItem>
                    <SelectItem value="all">All upcoming</SelectItem>
                    <SelectItem value="past">Past events</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-auto">
                <Switch checked={showDemo} onCheckedChange={setShowDemo} />
                Show demo
              </label>
            </div>
          </div>
        </Card>

        {/* Calendar View */}
        {sheets.length > 0 && (
          <div className="mb-6">
            {calendarView === 'month' && <MonthlyCalendar sheets={sheets} calendarEvents={calendarEvents} refetchEvents={refetchCalendarEvents} />}
            {calendarView === 'week' && <WeeklyCalendar sheets={sheets} calendarEvents={calendarEvents} refetchEvents={refetchCalendarEvents} />}
            {calendarView === 'list' && (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4" style={{ color: '#013f7c' }}>All Events</h2>
                {rangeFilteredEvents.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No events match your filters</p>
                ) : (
                  <div className="space-y-3">
                    {rangeFilteredEvents.slice(0, 200).map((event) => (
                      <div 
                        key={event.id}
                        className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <div>
                              <div className="font-semibold text-sm" style={{ color: '#013f7c' }}>
                                {format(parseISO(event.start_date), 'MMM d, yyyy')}
                              </div>
                              {!event.all_day && (
                                <div className="text-xs text-gray-600">{format(parseISO(event.start_date), 'h:mm a')}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-semibold text-gray-800">{event.title}</div>
                              {event.is_demo && <DemoBadge />}
                              {event.google_event_id && (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: event.color || '#264d44', color: 'white' }}>
                                {eventTypeConfig[event.event_type]?.label || 'Event'}
                              </span>
                            </div>
                            {event.client_name && (
                              <div className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                                <Users className="w-3 h-3" />
                                {event.client_name}
                              </div>
                            )}
                            {event.presenter && (
                              <div className="text-sm text-gray-600">
                                Presenter: {event.presenter}
                              </div>
                            )}
                            {event.location && (
                              <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </div>
                            )}
                            {isChallengeEvent(event, allServices.find(s => s.id === event.service_id)?.category) && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <FacilitationChecklist
                                  day0Count={getEventAssessmentCounts(event).day0}
                                  day14Count={getEventAssessmentCounts(event).day14}
                                  hasRecording={!!event.recording_link}
                                  compact
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {rangeFilteredEvents.length > 200 && (
                      <p className="text-sm text-gray-500 text-center pt-2">
                        Showing 200 of {rangeFilteredEvents.length} — narrow the range to see more
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* Survey Sends — collapsed summary below the calendar; auto-expands on errors */}
        <div className="mb-6">
          <SurveySendsCard />
        </div>

        {/* Company Search Section */}
        <CompanySearch sheets={sheets} onAddToCalendar={addSheetEventToAppCalendar} addingToCalendar={addingToCalendar} />

        {/* Sheets Tabs */}
        {sheets.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Schedule Data</h3>
            <p className="text-gray-500">
              Make sure your Google Sheet has data and is properly formatted.
            </p>
          </Card>
        ) : (
          <Tabs defaultValue="0" className="w-full">
            <TabsList className="mb-6 flex-wrap h-auto">
              {sheets.map((sheet, index) => (
                <TabsTrigger key={index} value={index.toString()}>
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {sheets.map((sheet, sheetIndex) => (
              <TabsContent key={sheetIndex} value={sheetIndex.toString()}>
                <Card className="overflow-auto max-h-[70vh]">
                  <div>
                    <table className="w-full">
                      <thead className="bg-[#264d44] text-white sticky top-0 z-20">
                        <tr>
                          {sheet.headers.map((header, idx) => (
                            <th
                              key={idx}
                              className={`px-4 py-3 text-left text-sm font-semibold whitespace-nowrap ${idx === 0 ? 'sticky left-0 z-30 bg-[#264d44]' : ''}`}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sheet.data.length > 0 ? (
                          sheet.data.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                              {sheet.headers.map((header, colIdx) => {
                                const isEditing = editingCell?.sheetName === sheet.name && 
                                                 editingCell?.rowIndex === rowIdx && 
                                                 editingCell?.columnIndex === colIdx;
                                const cellValue = row[header] || '';
                                
                                return (
                                  <td
                                    key={colIdx}
                                    className={`px-4 py-3 text-sm text-gray-700 ${colIdx === 0 ? 'sticky left-0 z-10 bg-white' : ''}`}
                                  >
                                    {isEditing ? (
                                      <div className="flex gap-1 min-w-[200px]">
                                        <Input
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCellSave();
                                            if (e.key === 'Escape') handleCellCancel();
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="h-8 text-sm flex-1"
                                          autoFocus
                                        />
                                        <Button size="sm" onClick={handleCellSave} className="h-8 px-2 flex-shrink-0">
                                          <Check className="w-4 h-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={handleCellCancel} className="h-8 px-2 flex-shrink-0">
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div 
                                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded group flex items-center gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCellEdit(sheet.name, rowIdx, colIdx, cellValue, sheet.headerRowIndex || 0);
                                        }}
                                      >
                                        <span>{cellValue || '-'}</span>
                                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td 
                              colSpan={sheet.headers.length} 
                              className="px-4 py-8 text-center text-gray-500"
                            >
                              No data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Auto-refresh indicator */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-refreshing every 30 seconds</span>
          </div>
        </div>
      </div>

      {/* Book Service Dialog */}
      <Dialog open={bookServiceDialogOpen} onOpenChange={setBookServiceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#013f7c] to-[#264d44] p-6 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-xl font-bold">{bookingSource === 'proposal' ? 'Book Service from Proposal' : 'Book Service from Invoice'}</DialogTitle>
                <p className="text-white/70 text-sm mt-0.5">{bookingSource === 'proposal' ? 'Schedule a service from an accepted or sent proposal' : 'Schedule a service linked to an existing invoice'}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Source toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => { setBookingSource('invoice'); setSelectedProposalId(''); setSelectedLineItem(null); }}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                  bookingSource === 'invoice' ? 'bg-[#013f7c] text-white border-[#013f7c]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#013f7c]'
                }`}
              >
                From Invoice
              </button>
              <button
                onClick={() => { setBookingSource('proposal'); setSelectedInvoiceId(''); setSelectedLineItem(null); }}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                  bookingSource === 'proposal' ? 'bg-[#770142] text-white border-[#770142]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#770142]'
                }`}
              >
                From Proposal
              </button>
            </div>

            {/* Step 1 - Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[#013f7c] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
                <h3 className="font-semibold text-gray-800">{bookingSource === 'invoice' ? 'Select Invoice' : 'Select Proposal'}</h3>
              </div>
              {bookingSource === 'invoice' ? (
                <Select value={selectedInvoiceId} onValueChange={handleInvoiceSelect}>
                  <SelectTrigger className="border-gray-200 bg-gray-50 focus:bg-white transition-colors">
                    <SelectValue placeholder="Choose an invoice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map(invoice => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`} — {invoice.client_name || invoice.company} — ${invoice.total_amount?.toLocaleString()}{invoice.created_date ? ` — ${new Date(invoice.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <ProposalPicker
                  proposals={proposals}
                  clients={allClients}
                  events={calendarEvents}
                  services={allServices}
                  value={selectedProposalId}
                  onChange={handleProposalSelect}
                />
              )}
            </div>

            {/* Step 2 - Service Items */}
            {bookingSource === 'invoice' && selectedInvoice && selectedInvoice.line_items && selectedInvoice.line_items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#013f7c] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
                  <h3 className="font-semibold text-gray-800">Select Service</h3>
                </div>
                <div className="space-y-2">
                  {selectedInvoice.line_items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleLineItemSelect(item)}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        selectedLineItem === item
                          ? 'border-[#264d44] bg-[#264d44]/5 shadow-sm'
                          : 'border-gray-100 bg-gray-50 hover:border-[#264d44]/40 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-gray-800">{item.description || item.name || 'Service'}</div>
                        <div className={`text-sm font-bold px-2 py-0.5 rounded-full ${selectedLineItem === item ? 'bg-[#264d44] text-white' : 'bg-gray-200 text-gray-600'}`}>
                          ${(item.amount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">Qty: {item.quantity || 1} × ${item.rate || 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bookingSource === 'proposal' && selectedProposalId && (() => {
              const proposal = proposals.find(p => p.id === selectedProposalId);
              const svcList = getProposalServices(proposal);
              return svcList.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#770142] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
                    <h3 className="font-semibold text-gray-800">Select Service from Proposal</h3>
                  </div>
                  <div className="space-y-2">
                    {svcList.map((svc, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleProposalServiceSelect(svc)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          selectedLineItem?.key === svc.key
                            ? 'border-[#770142] bg-[#770142]/5 shadow-sm'
                            : 'border-gray-100 bg-gray-50 hover:border-[#770142]/40 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-800">
                              {svc.name}
                              {svc.rawId && <span className="text-xs text-gray-400 ml-1.5 font-normal">{svc.rawId}</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{svc.label || svc.category}</div>
                          </div>
                          {svc.price > 0 && (
                            <div className={`text-sm font-bold px-2 py-0.5 rounded-full ${selectedLineItem?.key === svc.key ? 'bg-[#770142] text-white' : 'bg-gray-200 text-gray-600'}`}>
                              ${svc.price.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-gray-400 italic">No services found in this proposal.</p>;
            })()}

            {/* Step 3 - Booking Form */}
            {selectedLineItem && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[#013f7c] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
                  <h3 className="font-semibold text-gray-800">Event Details</h3>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Event Title</Label>
                      <Input
                        value={bookingForm.title}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter event title"
                        className="mt-1 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</Label>
                      <Select
                        value={bookingForm.client_id || 'none'}
                        onValueChange={(v) => {
                          const c = allClients.find(x => x.id === v);
                          setBookingForm(prev => ({
                            ...prev,
                            client_id: v === 'none' ? '' : v,
                            client_name: c?.name || c?.company || prev.client_name,
                            client_email: c?.email || prev.client_email,
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1 bg-white">
                          <SelectValue placeholder="Select client..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— No client linked —</SelectItem>
                          {allClients.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}{c.company && c.company !== c.name ? ` — ${c.company}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!bookingForm.client_id && bookingForm.client_name && (
                        <p className="text-xs text-amber-600 mt-1">⚠ No client linked — survey links won't appear. Select a client above.</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</Label>
                      <Select
                        value={bookingForm.service_id || 'none'}
                        onValueChange={(v) => {
                           const s = allServices.find(x => x.id === v);
                           const serviceName = s?.name || '';
                           const client = bookingForm.client_id ? allClients.find(c => c.id === bookingForm.client_id) : null;
                           const company = client?.company || bookingForm.client_name || '';
                           setBookingForm(prev => ({
                             ...prev,
                             service_id: v === 'none' ? '' : v,
                             title: serviceName ? (company ? `${serviceName} — ${company}` : serviceName) : prev.title,
                           }));
                         }}
                      >
                        <SelectTrigger className="mt-1 bg-white">
                          <SelectValue placeholder="Select service..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— No service linked —</SelectItem>
                          {allServices.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} <span className="text-gray-400 text-xs">({s.category})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!bookingForm.service_id && (
                        <p className="text-xs text-amber-600 mt-1">⚠ No service linked — survey links and materials won't appear.</p>
                      )}
                    </div>

                    {bookingForm.service_id && (() => {
                      const svc = allServices.find(s => s.id === bookingForm.service_id);
                      const calendarEventsList = calendarEvents || [];
                      const client = bookingForm.client_id ? allClients.find(c => c.id === bookingForm.client_id) : null;
                      const smartTiming = computeSmartAssessmentTiming({
                        client,
                        clientId: bookingForm.client_id,
                        serviceId: bookingForm.service_id,
                        events: calendarEventsList,
                        selectedDate: bookingForm.start_date,
                      });
                      const t = bookingForm.assessment_timing || smartTiming;
                      const count = t === 'baseline' ? 5 : (svc?.included_assessments || []).filter(a => a !== 'enps').length;
                      return (
                        <div className="sm:col-span-2">
                          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessment at check-in</Label>
                          <Select
                            value={bookingForm.assessment_timing || smartTiming}
                            onValueChange={(v) => setBookingForm(prev => ({ ...prev, assessment_timing: v }))}
                          >
                            <SelectTrigger className="mt-1 bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No assessment</SelectItem>
                              <SelectItem value="baseline">Baseline (first session)</SelectItem>
                              <SelectItem value="session">Every session (service instruments)</SelectItem>
                              <SelectItem value="endpoint">Endpoint (last session)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-400 mt-1">
                            Attendees will be asked {count} quick survey{count !== 1 ? 's' : ''} at check-in. Suggested: {smartTiming}.
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">Date & Time</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Start Date</Label>
                        <Input
                          type="date"
                          value={bookingForm.start_date}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, start_date: e.target.value }))}
                          className="mt-1 bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Start Time</Label>
                        <Input
                          type="time"
                          value={bookingForm.start_time}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, start_time: e.target.value }))}
                          className="mt-1 bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">End Date <span className="text-gray-400">(optional)</span></Label>
                        <Input
                          type="date"
                          value={bookingForm.end_date}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, end_date: e.target.value }))}
                          className="mt-1 bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">End Time <span className="text-gray-400">(optional)</span></Label>
                        <Input
                          type="time"
                          value={bookingForm.end_time}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, end_time: e.target.value }))}
                          className="mt-1 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 p-3 bg-white rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="all_day"
                        checked={bookingForm.all_day}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, all_day: e.target.checked }))}
                        className="rounded w-4 h-4 accent-[#264d44]"
                      />
                      <Label htmlFor="all_day" className="cursor-pointer text-sm text-gray-700">All-day event</Label>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</Label>
                    <Input
                      value={bookingForm.location}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Event location or meeting link"
                      className="mt-1 bg-white"
                    />
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Presenter</Label>
                    <div className="mt-1">
                      <Select
                        value={bookingForm.presenter_id || 'none'}
                        onValueChange={(v) => {
                          const p = activePresenters.find(x => x.id === v);
                          setBookingForm(prev => ({
                            ...prev,
                            presenter_id: v === 'none' ? '' : v,
                            presenter: p?.name || '',
                            presenter_email: p?.email || ''
                          }));
                        }}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select a presenter..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No presenter</SelectItem>
                          {activePresenters.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{p.email ? ` — ${p.email}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client Email</Label>
                    <Input
                      type="email"
                      value={bookingForm.client_email}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, client_email: e.target.value }))}
                      placeholder="Client email for invite"
                      className="mt-1 bg-white"
                    />
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</Label>
                    <Textarea
                      value={bookingForm.description}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Event description..."
                      rows={3}
                      className="mt-1 bg-white resize-none"
                    />
                  </div>

                </div>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => setBookServiceDialogOpen(false)} className="px-5">
              Cancel
            </Button>
            <Button
              onClick={handleBookService}
              disabled={!selectedLineItem || !bookingForm.title || !bookingForm.start_date || bookServiceMutation.isPending}
              className="bg-[#264d44] hover:bg-[#1a3830] px-6"
            >
              <Calendar className="w-4 h-4 mr-2" />
              {bookServiceMutation.isPending ? 'Booking...' : 'Book Service'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          eventTypeConfig={eventTypeConfig}
          onUpdated={() => {
            refetchCalendarEvents();
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}