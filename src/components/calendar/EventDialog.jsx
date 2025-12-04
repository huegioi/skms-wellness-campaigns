import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function EventDialog({ open, onOpenChange, selectedDate, clients, proposals, eventTypeConfig, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'meeting',
    start_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'09:00") : '',
    end_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'10:00") : '',
    all_day: false,
    client_id: '',
    client_name: '',
    proposal_id: '',
    location: '',
    color: ''
  });

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      client_name: client?.name || ''
    }));
  };

  const handleEventTypeChange = (type) => {
    const config = eventTypeConfig[type];
    let duration = 1; // hours
    let title = '';
    
    switch(type) {
      case 'workshop':
        duration = 1;
        title = '1-Hour Workshop';
        break;
      case 'leadership':
        duration = 1;
        title = 'Leadership Workshop';
        break;
      case 'challenge':
        title = '14-Day Challenge Start';
        break;
      case 'class':
        duration = 1;
        title = 'Weekly Class';
        break;
      case 'delivery':
        title = 'Wellness Box Delivery';
        break;
      case 'follow_up':
        title = 'Proposal Follow-up';
        break;
      default:
        title = '';
    }
    
    const startDate = new Date(formData.start_date);
    const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
    
    setFormData(prev => ({
      ...prev,
      event_type: type,
      title: prev.title || title,
      end_date: format(endDate, "yyyy-MM-dd'T'HH:mm"),
      color: config.color
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.start_date) return;
    
    setSaving(true);
    await base44.entities.CalendarEvent.create({
      ...formData,
      color: formData.color || eventTypeConfig[formData.event_type]?.color
    });
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Event</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Event Type *</label>
            <Select value={formData.event_type} onValueChange={handleEventTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(eventTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: config.color }}></div>
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Title *</label>
            <Input 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Event title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
            <Textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Add details..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox 
              id="all_day"
              checked={formData.all_day} 
              onCheckedChange={(checked) => setFormData({...formData, all_day: checked})}
            />
            <label htmlFor="all_day" className="text-sm text-gray-600">All day event</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start *
              </label>
              <Input 
                type={formData.all_day ? "date" : "datetime-local"}
                value={formData.all_day ? formData.start_date.split('T')[0] : formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: formData.all_day ? e.target.value : e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                End
              </label>
              <Input 
                type={formData.all_day ? "date" : "datetime-local"}
                value={formData.all_day ? formData.end_date.split('T')[0] : formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
              />
            </div>
          </div>

          {formData.event_type === 'leadership' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Workshop Duration</label>
              <Select 
                value={formData.title.includes('3') ? '3' : '1'}
                onValueChange={(val) => {
                  const startDate = new Date(formData.start_date);
                  const endDate = new Date(startDate.getTime() + parseInt(val) * 60 * 60 * 1000);
                  setFormData({
                    ...formData, 
                    title: `${val}-Hour Leadership Workshop`,
                    end_date: format(endDate, "yyyy-MM-dd'T'HH:mm")
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Hour</SelectItem>
                  <SelectItem value="3">3 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location / Meeting Link
            </label>
            <Input 
              value={formData.location} 
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="Office, Zoom link, etc..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Client (Optional)</label>
            <Select value={formData.client_id} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No client</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(formData.event_type === 'follow_up' || formData.event_type === 'meeting') && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Related Proposal</label>
              <Select value={formData.proposal_id} onValueChange={(val) => setFormData({...formData, proposal_id: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a proposal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No proposal</SelectItem>
                  {proposals.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.client_name} - ${p.total_amount?.toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || !formData.title} className="w-full bg-[#770142] hover:bg-[#5a0132]">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Create Event'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}