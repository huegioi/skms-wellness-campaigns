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
import { RefreshCw, Calendar, Clock, MapPin, Users, ExternalLink, Plus, Pencil, Check, X, FileText } from 'lucide-react';
import MonthlyCalendar from '@/components/scheduling/MonthlyCalendar';
import { toast } from 'sonner';

export default function SchedulingHub() {
  const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [bookServiceDialogOpen, setBookServiceDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
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
    all_day: false
  });
  const queryClient = useQueryClient();

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

  const bookServiceMutation = useMutation({
    mutationFn: async (eventData) => {
      const startDateTime = `${eventData.start_date}T${eventData.start_time || '09:00'}:00`;
      const endDateTime = eventData.end_date && eventData.end_time 
        ? `${eventData.end_date}T${eventData.end_time}:00`
        : new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();

      // Create event in CalendarEvent entity
      const calendarEvent = await base44.entities.CalendarEvent.create({
        title: eventData.title,
        description: eventData.description || '',
        location: eventData.location || '',
        start_date: startDateTime,
        end_date: endDateTime,
        all_day: eventData.all_day,
        event_type: 'other',
        client_name: eventData.client_name || '',
        color: '#264d44'
      });

      // Sync to Google Calendar
      const response = await base44.functions.invoke('googleCalendarSync', {
        action: 'createEvent',
        eventData: {
          id: calendarEvent.id,
          title: eventData.title,
          description: eventData.description || '',
          location: eventData.location || '',
          start_date: startDateTime,
          end_date: endDateTime,
          all_day: eventData.all_day,
          event_type: 'other'
        }
      });

      if (response.data.success) {
        // Update with Google Calendar event ID
        await base44.entities.CalendarEvent.update(calendarEvent.id, {
          google_event_id: response.data.googleEventId
        });
      }

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

  // Parse upcoming events from all sheets
  const getUpcomingEvents = () => {
    const events = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

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

        // Check if within next month
        if (eventDate >= now && eventDate <= nextMonth) {
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
          
          events.push({
            date: eventDate,
            title,
            client: row['Client'] || row['Payee'] || row['Company'] || row['CLIENT'] || row['client'] || row['PAYEE'] || '',
            location: row['Location'] || row['LOCATION'] || row['location'] || row['Venue'] || row['VENUE'] || '',
            time: row['Time'] || row['TIME'] || row['time'] || '',
            presenter: row['Presenter'] || row['PRESENTER'] || row['presenter'] || '',
            linkToHost: row['Link to Host Video'] || row['Link To Host Video'] || row['link to host video'] || row['LINK TO HOST VIDEO'] || '',
            recording: row['Recording'] || row['RECORDING'] || row['recording'] || row['Need Recording'] || row['NEED RECORDING'] || '',
            translation: row['Translation'] || row['TRANSLATION'] || row['translation'] || row['Need Translation'] || row['NEED TRANSLATION'] || '',
            sheet: sheet.name,
            rawRow: row
          });
        }
      });
    });

    return events.sort((a, b) => a.date - b.date);
  };

  const upcomingEvents = getUpcomingEvents();

  const addToGoogleCalendar = async (event) => {
    try {
      const startDate = new Date(event.date);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);

      let description = `Client: ${event.client}\nSheet: ${event.sheet}`;
      if (event.presenter) description += `\nPresenter: ${event.presenter}`;
      if (event.linkToHost) description += `\nLink to Host Video: ${event.linkToHost}`;
      if (event.recording) description += `\nRecording: ${event.recording}`;
      if (event.translation) description += `\nTranslation: ${event.translation}`;

      const response = await base44.functions.invoke('googleCalendarSync', {
        action: 'createEvent',
        eventData: {
          title: event.title,
          description: description,
          location: event.location || '',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          all_day: false
        }
      });

      if (response.data.success) {
        alert('Event added to Google Calendar!');
      }
    } catch (error) {
      alert('Failed to add to Google Calendar: ' + error.message);
    }
  };

  const handleInvoiceSelect = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    setSelectedLineItem(null);
    
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setBookingForm(prev => ({
        ...prev,
        client_name: invoice.client_name || invoice.company || ''
      }));
    }
  };

  const handleLineItemSelect = (lineItem) => {
    setSelectedLineItem(lineItem);
    setBookingForm(prev => ({
      ...prev,
      title: lineItem.description || lineItem.name || '',
      description: `Service from invoice\n\nQuantity: ${lineItem.quantity || 1}\nRate: $${lineItem.rate || 0}`
    }));
  };

  const resetBookingForm = () => {
    setSelectedInvoiceId('');
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
      all_day: false
    });
  };

  const handleBookService = () => {
    if (!bookingForm.title || !bookingForm.start_date) {
      toast.error('Please fill in the service name and start date');
      return;
    }
    bookServiceMutation.mutate(bookingForm);
  };

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8" style={{ color: '#013f7c' }} />
              <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>
                {spreadsheetTitle}
              </h1>
            </div>
            <p className="text-gray-600">
              Real-time sync with Google Sheets • Auto-updates every 30 seconds
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setBookServiceDialogOpen(true)}
              className="bg-[#770142] hover:bg-[#5a0132]"
            >
              <FileText className="w-4 h-4 mr-2" />
              Book from Invoice
            </Button>
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#264d44] hover:bg-[#1a3830]">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Sheet
              </Button>
            </a>
          </div>
        </div>

        {/* Coming Up Section */}
        {upcomingEvents.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#013f7c' }}>
                <Clock className="w-5 h-5" />
                Coming Up (Next 30 Days)
              </h2>
              <div className="space-y-3">
                {upcomingEvents.slice(0, 8).map((event, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-blue-100 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="font-semibold text-sm" style={{ color: '#013f7c' }}>
                            {event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          {event.time && (
                            <div className="text-xs text-gray-600">{event.time}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800 mb-1">{event.title}</div>
                        {event.client && (
                          <div className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                            <Users className="w-3 h-3" />
                            {event.client}
                          </div>
                        )}
                        {event.presenter && (
                          <div className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Presenter:</span> {event.presenter}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">• {event.sheet}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addToGoogleCalendar(event)}
                        className="bg-[#264d44] hover:bg-[#1a3830] whitespace-nowrap self-start"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add to Cal
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {upcomingEvents.length > 8 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  +{upcomingEvents.length - 8} more event{upcomingEvents.length - 8 !== 1 ? 's' : ''} coming up
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Calendar View */}
        {sheets.length > 0 && (
          <div className="mb-6">
            <MonthlyCalendar sheets={sheets} />
          </div>
        )}

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
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#264d44] text-white">
                        <tr>
                          {sheet.headers.map((header, idx) => (
                            <th key={idx} className="px-4 py-3 text-left text-sm font-semibold">
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
                                  <td key={colIdx} className="px-4 py-3 text-sm text-gray-700">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Service from Invoice</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Invoice Selection */}
            <div>
              <Label>Select Invoice</Label>
              <Select value={selectedInvoiceId} onValueChange={handleInvoiceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an invoice..." />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map(invoice => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`} - {invoice.client_name || invoice.company} - ${invoice.total_amount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Line Items Selection */}
            {selectedInvoice && selectedInvoice.line_items && selectedInvoice.line_items.length > 0 && (
              <div>
                <Label>Select Service</Label>
                <div className="space-y-2 mt-2">
                  {selectedInvoice.line_items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleLineItemSelect(item)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedLineItem === item 
                          ? 'border-[#264d44] bg-[#264d44]/5' 
                          : 'border-gray-200 hover:border-[#264d44]/50'
                      }`}
                    >
                      <div className="font-medium">{item.description || item.name || 'Service'}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Qty: {item.quantity || 1} × ${item.rate || 0} = ${item.amount || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Booking Form */}
            {selectedLineItem && (
              <>
                <div>
                  <Label>Event Title</Label>
                  <Input
                    value={bookingForm.title}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter event title"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={bookingForm.description}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Event description..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Client Name</Label>
                  <Input
                    value={bookingForm.client_name}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="Client name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={bookingForm.start_date}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={bookingForm.start_time}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, start_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>End Date (optional)</Label>
                    <Input
                      type="date"
                      value={bookingForm.end_date}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>End Time (optional)</Label>
                    <Input
                      type="time"
                      value={bookingForm.end_time}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Location</Label>
                  <Input
                    value={bookingForm.location}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Event location or meeting link"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="all_day"
                    checked={bookingForm.all_day}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, all_day: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="all_day" className="cursor-pointer">All-day event</Label>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookServiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBookService}
              disabled={!selectedLineItem || !bookingForm.title || !bookingForm.start_date || bookServiceMutation.isPending}
              className="bg-[#264d44] hover:bg-[#1a3830]"
            >
              {bookServiceMutation.isPending ? 'Booking...' : 'Book Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}