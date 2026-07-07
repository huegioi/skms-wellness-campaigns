import React, { useState } from 'react';
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
import MonthlyCalendar from '@/components/scheduling/MonthlyCalendar';
import WeeklyCalendar from '@/components/scheduling/WeeklyCalendar';
import CompanySearch from '@/components/scheduling/CompanySearch';
import ScheduleChecklist from '@/components/scheduling/ScheduleChecklist';
import EventDetailDialog from '@/components/calendar/EventDetailDialog';
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
    all_day: false
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
  const [addingToCalendar, setAddingToCalendar] = useState(null);
  const [calendarView, setCalendarView] = useState('week'); // 'month', 'week', 'list'
  const [filterType, setFilterType] = useState('all');
  const [filterPresenter, setFilterPresenter] = useState('all');
  const queryClient = useQueryClient();

  const eventTypeConfig = {
    meeting: { label: 'Meeting', color: '#3B82F6', icon: Calendar },
    workshop: { label: 'Workshop', color: '#8B5CF6', icon: Calendar },
    challenge: { label: 'Challenge', color: '#10B981', icon: Calendar },
    leadership: { label: 'Leadership', color: '#F59E0B', icon: Calendar },
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
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date')
  });

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
        client_id: eventData.client_id || resolvedClientId,
        service_id: eventData.service_id || null,
        presenter: eventData.presenter || '',
        presenter_id: eventData.presenter_id || null,
        presenter_email: eventData.presenter_email || '',
        proposal_id: eventData.proposal_id || '',
        color: '#264d44'
      });

      return calendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      toast.success('Service booked successfully!');
      setBookServiceDialogOpen(false);
      resetBookingForm();
    },
    onError: (error) => {
      toast.error('Failed to book service: ' + error.message);
    }
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
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

  // Parse all sheet events for upcoming section
  const parseSheetEvents = () => {
    const events = [];
    const sevenDaysAgoParsed = new Date();
    sevenDaysAgoParsed.setDate(sevenDaysAgoParsed.getDate() - 7);
    sevenDaysAgoParsed.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    sheets.forEach(sheet => {
      sheet.data.forEach(row => {
        // Look for date columns - be more flexible
        let dateValue = null;
        let dateKey = null;
        
        for (const [key, value] of Object.entries(row)) {
          const keyLower = key.toLowerCase();
          if ((keyLower.includes('date') || keyLower.includes('day') || keyLower === 'when') && value && value.trim() !== '') {
            dateValue = value;
            dateKey = key;
            break;
          }
        }
        
        if (!dateValue || dateValue.trim() === '') return;

        // Parse date - handle various formats
        let eventDate;
        try {
          // Try parsing as-is
          eventDate = new Date(dateValue);
          
          // If invalid, try common formats
          if (isNaN(eventDate.getTime())) {
            // Try MM/DD/YYYY or M/D/YYYY
            const parts = dateValue.split('/');
            if (parts.length === 3) {
              eventDate = new Date(parts[2], parts[0] - 1, parts[1]);
            }
          }
          
          if (isNaN(eventDate.getTime())) return;
        } catch {
          return;
        }

        // Check if within last 7 days or next 30 days
        if (eventDate >= sevenDaysAgoParsed && eventDate <= thirtyDaysFromNow) {
          // Find event/service name
          let title = 'Untitled Event';
          for (const [key, value] of Object.entries(row)) {
            if ((key.toLowerCase().includes('event') || 
                 key.toLowerCase().includes('service') || 
                 key.toLowerCase().includes('title') ||
                 key.toLowerCase().includes('name')) && value) {
              title = value;
              break;
            }
          }
          
          // Case-insensitive lookup helper
          const findVal = (row, ...keywords) => {
            for (const [key, value] of Object.entries(row)) {
              const keyLower = key.toLowerCase().trim();
              if (keywords.some(kw => keyLower === kw || keyLower.includes(kw)) && value && value.trim() !== '') {
                return value;
              }
            }
            return '';
          };

          events.push({
            date: eventDate,
            title,
            client: findVal(row, 'client', 'payee', 'company'),
            location: findVal(row, 'location', 'venue', 'place', 'address'),
            time: findVal(row, 'time'),
            presenter: findVal(row, 'presenter', 'facilitator', 'speaker'),
            linkToHost: findVal(row, 'link to host', 'host video', 'host link'),
            recording: findVal(row, 'recording', 'need recording'),
            translation: findVal(row, 'translation', 'need translation'),
            sheet: sheet.name,
            rawRow: row,
            source: 'sheet'
          });
        }
      });
    });

    return events;
  };

  const sheetEvents = parseSheetEvents();

  // Get upcoming CalendarEvent entities (next 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  
  // Get unique presenters for filter
  const allPresenters = [...new Set(calendarEvents
    .filter(e => e.presenter)
    .map(e => e.presenter)
  )];
  
  // Filter events based on selected filters
  const filteredCalendarEvents = (calendarEvents || [])
    .filter(event => {
      const typeMatch = filterType === 'all' || event.event_type === filterType;
      const presenterMatch = filterPresenter === 'all' || event.presenter === filterPresenter;
      return typeMatch && presenterMatch;
    });
  
  const upcomingCalendarEvents = filteredCalendarEvents
    .filter(event => {
      const eventDate = parseISO(event.start_date);
      return eventDate >= sevenDaysAgo && eventDate <= thirtyDaysFromNow;
    })
    .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date));

  // Combine sheet events with calendar events (including recent past)
  const combinedUpcomingEvents = (() => {
    const combined = [];
    const addedKeys = new Set();

    // Add calendar events first
    upcomingCalendarEvents.forEach(event => {
      const key = `${event.title?.toLowerCase().trim()}|${parseISO(event.start_date).toLocaleDateString()}`;
      addedKeys.add(key);
      combined.push({
        ...event,
        source: 'calendar',
        date: parseISO(event.start_date),
        isPast: parseISO(event.start_date) < now
      });
    });

    // Add sheet events that aren't already in calendar (match by title only to handle slight name variations)
    sheetEvents.forEach(sheetEvent => {
      const key = `${sheetEvent.title?.toLowerCase().trim()}|${sheetEvent.date.toLocaleDateString()}`;
      if (!addedKeys.has(key)) {
        combined.push({
          ...sheetEvent,
          source: 'sheet',
          client_name: sheetEvent.client,
          isPast: sheetEvent.date < now
        });
      }
    });

    return combined.sort((a, b) => a.date - b.date);
  })();

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
      setBookingForm(prev => ({
        ...prev,
        client_name: proposal.client_name || proposal.company || '',
        client_id: proposal.client_id || '',
      }));
    }
  };

  const getProposalServices = (proposal) => {
    if (!proposal?.selections) return [];
    const sel = proposal.selections;
    const items = [];
    const addItems = (dataKey, fallbackKey, label) => {
      if (sel[dataKey]?.length > 0) {
        sel[dataKey].forEach(svc => items.push({ name: svc.name, price: svc.price || 0, category: label, description: svc.description || '' }));
      } else if (sel[fallbackKey]?.length > 0) {
        sel[fallbackKey].forEach(id => items.push({ name: id, price: 0, category: label, description: '' }));
      }
    };
    addItems('workshopsData', 'workshops', 'Workshop');
    addItems('challengeProgramsData', 'challengePrograms', 'Challenge');
    addItems('leadershipData', 'leadership', 'Leadership');
    addItems('movementClassesData', 'movementClasses', 'Class');
    return items;
  };

  const handleLineItemSelect = (lineItem) => {
    setSelectedLineItem(lineItem);
    const itemName = lineItem.description || lineItem.name || '';
    const matchedService = allServices.find(s =>
      (s.name || '').toLowerCase() === itemName.toLowerCase()
    );
    setBookingForm(prev => ({
      ...prev,
      title: itemName,
      service_id: lineItem.service_id || matchedService?.id || '',
      description: lineItem.description ? `Service from invoice\n\nQuantity: ${lineItem.quantity || 1}\nRate: $${lineItem.rate || 0}` : ''
    }));
  };

  const handleProposalServiceSelect = (svc) => {
    setSelectedLineItem(svc);
    const matchedService = allServices.find(s =>
      (s.name || '').toLowerCase() === (svc.name || '').toLowerCase()
    );
    setBookingForm(prev => ({
      ...prev,
      title: svc.name || '',
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
      all_day: false
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
                {spreadsheetTitle}
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

        {/* Coming Up Section - Combined Events */}
        {combinedUpcomingEvents.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#013f7c' }}>
                <Clock className="w-5 h-5" />
                Coming Up (Next 30 Days)
              </h2>
              <div className="space-y-3">
                {combinedUpcomingEvents.slice(0, 10).map((event, idx) => (
                  <div 
                    key={event.source === 'calendar' ? event.id : `sheet-${idx}`} 
                    className={`rounded-lg p-4 border hover:shadow-md transition-shadow ${
                      event.isPast 
                        ? 'bg-gray-50 border-gray-200 opacity-70' 
                        : event.source === 'calendar' 
                          ? 'bg-white cursor-pointer border-blue-100' 
                          : 'bg-white border-gray-200'
                    }`}
                    onClick={() => !event.isPast && event.source === 'calendar' && setSelectedEvent(event)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <Calendar className={`w-5 h-5 ${event.isPast ? 'text-gray-400' : event.source === 'calendar' ? 'text-blue-600' : 'text-gray-500'}`} />
                        <div>
                          <div className={`font-semibold text-sm ${event.isPast ? 'text-gray-400' : ''}`} style={event.isPast ? {} : { color: '#013f7c' }}>
                            {event.source === 'calendar' 
                              ? format(parseISO(event.start_date), 'MMM d')
                              : event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            }
                          </div>
                          {event.source === 'calendar' && !event.all_day && (
                            <div className="text-xs text-gray-500">{format(parseISO(event.start_date), 'h:mm a')}</div>
                          )}
                          {event.source === 'sheet' && event.time && (
                            <div className="text-xs text-gray-500">{event.time}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`font-semibold ${event.isPast ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{event.title}</div>
                          {event.isPast && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-500">Past</span>
                          )}
                          {!event.isPast && event.source === 'calendar' && event.google_event_id && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                          {!event.isPast && event.source === 'sheet' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              From Sheet
                            </span>
                          )}
                          {event.isPast && event.source === 'sheet' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400">
                              From Sheet
                            </span>
                          )}
                        </div>
                        {event.client_name && (
                          <div className={`text-sm flex items-center gap-1 mb-1 ${event.isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Users className="w-3 h-3" />
                            {event.client_name}
                          </div>
                        )}
                        {event.presenter && (
                          <div className={`text-sm mb-1 ${event.isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span className="font-medium">Presenter:</span> {event.presenter}
                          </div>
                        )}
                        {event.location && (
                          <div className={`text-sm flex items-start gap-1 ${event.isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="break-all">{event.location}</span>
                          </div>
                        )}
                      </div>
                      {!event.isPast && event.source === 'sheet' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addSheetEventToAppCalendar(event);
                          }}
                          disabled={addingToCalendar === event.title}
                          className="bg-[#264d44] hover:bg-[#1a3830] whitespace-nowrap self-start"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {addingToCalendar === event.title ? 'Adding...' : 'Add to Calendar'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {combinedUpcomingEvents.length > 10 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  +{combinedUpcomingEvents.length - 10} more event{combinedUpcomingEvents.length - 10 !== 1 ? 's' : ''} coming up
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
                {filteredCalendarEvents.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No events match your filters</p>
                ) : (
                  <div className="space-y-3">
                    {filteredCalendarEvents.slice(0, 50).map((event) => (
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

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
                <DialogTitle className="text-white text-xl font-bold">Book Service from Invoice</DialogTitle>
                <p className="text-white/70 text-sm mt-0.5">Schedule a service linked to an existing invoice</p>
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
                        {invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`} — {invoice.client_name || invoice.company} — ${invoice.total_amount?.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedProposalId} onValueChange={handleProposalSelect}>
                  <SelectTrigger className="border-gray-200 bg-gray-50 focus:bg-white transition-colors">
                    <SelectValue placeholder="Choose a proposal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {proposals.map(proposal => (
                      <SelectItem key={proposal.id} value={proposal.id}>
                        {proposal.client_name} {proposal.company ? `— ${proposal.company}` : ''} — ${proposal.total_amount?.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                          selectedLineItem === svc
                            ? 'border-[#770142] bg-[#770142]/5 shadow-sm'
                            : 'border-gray-100 bg-gray-50 hover:border-[#770142]/40 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-800">{svc.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{svc.category}</div>
                          </div>
                          {svc.price > 0 && (
                            <div className={`text-sm font-bold px-2 py-0.5 rounded-full ${selectedLineItem === svc ? 'bg-[#770142] text-white' : 'bg-gray-200 text-gray-600'}`}>
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
                          setBookingForm(prev => ({
                            ...prev,
                            service_id: v === 'none' ? '' : v,
                            title: prev.title || s?.name || '',
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
                      {activePresenters.length > 0 ? (
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
                      ) : (
                        <Input
                          value={bookingForm.presenter}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, presenter: e.target.value }))}
                          placeholder="Presenter name"
                          className="bg-white"
                        />
                      )}
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