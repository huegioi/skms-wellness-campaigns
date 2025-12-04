import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, FileText, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function EventDetailDialog({ event, open, onOpenChange, eventTypeConfig, onUpdated }) {
  const [deleting, setDeleting] = useState(false);
  
  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
  const Icon = config.icon;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    setDeleting(true);
    await base44.entities.CalendarEvent.delete(event.id);
    setDeleting(false);
    onUpdated?.();
    onOpenChange(false);
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
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SKMS Wellness//Calendar//EN
BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: event.color || config.color }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle>{event.title}</DialogTitle>
              <Badge style={{ backgroundColor: event.color || config.color }} className="text-white mt-1">
                {config.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>
        
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
                    Join meeting
                  </a>
                )}
              </div>
            </div>
          )}

          {event.client_name && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <p className="font-medium">{event.client_name}</p>
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

          {/* Export Options */}
          <div className="pt-3 border-t">
            <p className="text-sm font-medium text-gray-600 mb-2">Add to Calendar:</p>
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

          <div className="pt-3 border-t flex justify-end">
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Event
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}