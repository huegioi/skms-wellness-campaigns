import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, MapPin, Loader2, Package, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { productCatalog } from '@/components/curriculum/catalogData';
import { useQuery } from '@tanstack/react-query';
import { computeSmartAssessmentTiming } from '@/lib/checkinAssessmentUtils';
import { ClipboardCheck } from 'lucide-react';

export default function EventDialog({ open, onOpenChange, selectedDate, clients, proposals, eventTypeConfig, onSaved, prefillLeadId }) {
  const [saving, setSaving] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  // Fetch services from catalog
  const { data: catalogServices = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  // Fetch active presenters for dropdown
  const { data: activePresenters = [] } = useQuery({
    queryKey: ['presenters-active'],
    queryFn: async () => {
      const all = await base44.entities.Presenter.list('name');
      return all.filter(p => p.is_active !== false);
    }
  });

  // Fetch leads for the contact picker (clients are passed as a prop)
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-event'],
    queryFn: () => base44.entities.Lead.list('name', 500)
  });

  // Fetch existing events for the selected client + service (for smart assessment default)
  const { data: clientServiceEvents = [] } = useQuery({
    queryKey: ['client-service-events', formData.client_id, formData.service_id],
    queryFn: async () => {
      if (!formData.client_id || !formData.service_id) return [];
      return base44.entities.CalendarEvent.filter(
        { client_id: formData.client_id, service_id: formData.service_id }, 'start_date', 100
      );
    },
    enabled: !!formData.client_id && !!formData.service_id,
  });

  // Compute smart default for assessment_timing
  const selectedService = catalogServices.find(s => s.id === formData.service_id);
  const hasAssessments = selectedService?.included_assessments?.length > 0;

  // Auto-set assessment_timing when service or client changes
  useEffect(() => {
    if (!formData.service_id || !hasAssessments) {
      if (formData.assessment_timing !== 'none') {
        setFormData(prev => ({ ...prev, assessment_timing: 'none' }));
      }
      return;
    }
    const smart = computeSmartAssessmentTiming({
      clientId: formData.client_id,
      serviceId: formData.service_id,
      events: clientServiceEvents,
      selectedDate: formData.start_date,
    });
    setFormData(prev => ({ ...prev, assessment_timing: smart }));
  }, [formData.service_id, formData.client_id, formData.start_date, hasAssessments, clientServiceEvents]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'meeting',
    start_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'09:00") : '',
    end_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'10:00") : '',
    all_day: false,
    client_id: '',
    lead_id: '',
    client_name: '',
    proposal_id: '',
    location: '',
    presenter_id: '',
    service_id: '',
    assessment_timing: 'none',
    color: ''
  });

  // Prefill a lead when opened from outside the scheduler (e.g., follow-up queue "Book Call")
  useEffect(() => {
    if (open && prefillLeadId) {
      const lead = leads.find(l => l.id === prefillLeadId);
      if (lead) {
        setFormData(prev => ({
          ...prev,
          lead_id: prefillLeadId,
          client_id: '',
          client_name: lead.name || '',
          proposal_id: '',
        }));
        setSelectedProposal(null);
      }
    }
  }, [open, prefillLeadId, leads]);

  // Unified contact picker — value encodes type:id ('client:<id>' | 'lead:<id>' | 'none')
  const handleContactChange = (value) => {
    if (value === 'none') {
      setFormData(prev => ({ ...prev, client_id: '', lead_id: '', client_name: '', proposal_id: '' }));
      setSelectedProposal(null);
      return;
    }
    const [type, id] = value.split(':');
    if (type === 'client') {
      const client = clients.find(c => c.id === id);
      setFormData(prev => ({ ...prev, client_id: id, lead_id: '', client_name: client?.name || '', proposal_id: '' }));
    } else {
      const lead = leads.find(l => l.id === id);
      setFormData(prev => ({ ...prev, lead_id: id, client_id: '', client_name: lead?.name || '', proposal_id: '' }));
    }
    setSelectedProposal(null);
  };

  const contactValue = formData.client_id
    ? `client:${formData.client_id}`
    : formData.lead_id
      ? `lead:${formData.lead_id}`
      : 'none';

  const handleProposalChange = (proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId);
    setSelectedProposal(proposal);
    setFormData(prev => ({
      ...prev,
      proposal_id: proposalId
    }));
    if (proposal) {
      setShowServicePicker(true);
    }
  };

  const getProposalServices = () => {
    if (!selectedProposal?.selections) return [];
    const services = [];
    const sel = selectedProposal.selections;
    
    sel.workshops?.forEach(key => {
      const workshop = productCatalog.workshops[key];
      if (workshop) services.push({ type: 'workshop', key, name: workshop.name, duration: 1 });
    });
    
    sel.challengePrograms?.forEach(key => {
      const challenge = productCatalog.challenges[key];
      if (challenge) services.push({ type: 'challenge', key, name: challenge.name, duration: 14 });
    });
    
    sel.leadership?.forEach(key => {
      const program = productCatalog.leadership[key];
      if (program) services.push({ type: 'leadership', key, name: program.name, duration: program.name.includes('3') ? 3 : 1 });
    });
    
    sel.movementClasses?.forEach(key => {
      const classItem = productCatalog.movementClasses[key];
      if (classItem) services.push({ type: 'class', key, name: classItem.name, duration: 1 });
    });
    
    const boxes = sel.sampleBoxQuantities || {};
    if (boxes.reduceStress > 0) services.push({ type: 'delivery', key: 'reduceStress', name: `Reduce Stress Box (${boxes.reduceStress})`, duration: 0 });
    if (boxes.relaxationSleep > 0) services.push({ type: 'delivery', key: 'relaxationSleep', name: `Relaxation & Sleep Box (${boxes.relaxationSleep})`, duration: 0 });
    if (boxes.largeEmotional > 0) services.push({ type: 'delivery', key: 'largeEmotional', name: `Large Emotional Wellness Box (${boxes.largeEmotional})`, duration: 0 });
    if (boxes.largeStressReduction > 0) services.push({ type: 'delivery', key: 'largeStressReduction', name: `Large Stress Reduction Box (${boxes.largeStressReduction})`, duration: 0 });
    
    return services;
  };

  const selectService = (service) => {
    const config = eventTypeConfig[service.type];
    const startDate = new Date(formData.start_date);
    const durationHours = service.duration_hours || service.duration || 1;
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
    
    // Use service description instead of contact info
    let description = service.description || service.short_description || '';
    if (service.key_benefits?.length > 0) {
      description += '\n\nKey Benefits:\n• ' + service.key_benefits.join('\n• ');
    }
    
    setFormData(prev => ({
      ...prev,
      title: service.name,
      event_type: service.type,
      description: description,
      end_date: service.type === 'challenge' ? format(new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm") : format(endDate, "yyyy-MM-dd'T'HH:mm"),
      color: config?.color,
      all_day: service.type === 'delivery'
    }));
    setShowServicePicker(false);
    setShowCatalogPicker(false);
  };

  const selectCatalogService = (service) => {
    const categoryMap = {
      'workshop': 'workshop',
      'challenge': 'challenge', 
      'leadership': 'leadership',
      'class': 'class',
      'wellness_box': 'delivery'
    };
    const eventType = categoryMap[service.category] || 'other';
    const config = eventTypeConfig[eventType];
    const startDate = new Date(formData.start_date);
    const durationHours = service.duration_hours || 1;
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
    
    let description = service.description || service.short_description || '';
    if (service.key_benefits?.length > 0) {
      description += '\n\nKey Benefits:\n• ' + service.key_benefits.join('\n• ');
    }
    
    setFormData(prev => ({
      ...prev,
      title: service.name,
      event_type: eventType,
      description: description,
      end_date: service.category === 'challenge' ? format(new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm") : format(endDate, "yyyy-MM-dd'T'HH:mm"),
      color: config?.color,
      all_day: service.category === 'wellness_box',
      service_id: service.id,
    }));
    setShowCatalogPicker(false);
  };

  const handleEventTypeChange = (type) => {
    const config = eventTypeConfig[type];
    let duration = 1;
    let title = '';
    
    switch(type) {
      case 'workshop': duration = 1; title = '1-Hour Workshop'; break;
      case 'leadership': duration = 1; title = 'Leadership Workshop'; break;
      case 'presentation': duration = 1; title = 'Presentation'; break;
      case 'challenge': title = '14-Day Challenge Start'; break;
      case 'class': duration = 1; title = 'Weekly Class'; break;
      case 'delivery': title = 'Wellness Box Delivery'; break;
      case 'follow_up': title = 'Proposal Follow-up'; break;
      default: title = '';
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

  // Fetch sync settings
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: syncSettings } = useQuery({
    queryKey: ['calendarSync', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const settings = await base44.entities.CalendarSync.filter({ user_email: user.email });
      return settings[0] || null;
    },
    enabled: !!user?.email
  });

  const handleSave = async () => {
    if (!formData.title || !formData.start_date) return;
    
    setSaving(true);
    const eventData = {
      ...formData,
      checkin_token: crypto.randomUUID(),
      color: formData.color || eventTypeConfig[formData.event_type]?.color
    };
    
    const newEvent = await base44.entities.CalendarEvent.create(eventData);
    
    // Update client's last_contacted_date
    if (eventData.client_id) {
      await base44.entities.Client.update(eventData.client_id, { last_contacted_date: new Date().toISOString().split('T')[0] });
    }
    
    // Auto-sync to Google if enabled
    if (syncSettings?.google_enabled && (syncSettings.google_sync_direction === 'to_google' || syncSettings.google_sync_direction === 'both')) {
      try {
        const response = await base44.functions.invoke('googleCalendarSync', {
          action: 'createEvent',
          eventData: { ...eventData, id: newEvent.id },
          calendarId: syncSettings.google_calendar_id || 'primary'
        });
        if (response.data?.googleEventId) {
          await base44.entities.CalendarEvent.update(newEvent.id, { google_event_id: response.data.googleEventId });
        }
      } catch (e) {
        console.error('Google sync failed:', e);
      }
    }
    
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  };

  const handleSaveAndAddToGoogle = async () => {
    if (!formData.title || !formData.start_date) return;
    
    setSaving(true);
    const eventData = {
      ...formData,
      checkin_token: crypto.randomUUID(),
      color: formData.color || eventTypeConfig[formData.event_type]?.color
    };
    
    const newEvent = await base44.entities.CalendarEvent.create(eventData);
    
    // Sync to Google Calendar via API
    try {
      const response = await base44.functions.invoke('googleCalendarSync', {
        action: 'createEvent',
        eventData: { ...eventData, id: newEvent.id },
        calendarId: syncSettings?.google_calendar_id || 'primary'
      });
      if (response.data?.googleEventId) {
        await base44.entities.CalendarEvent.update(newEvent.id, { google_event_id: response.data.googleEventId });
      }
    } catch (e) {
      console.error('Google sync failed:', e);
      // Fallback to URL method
      const startDate = new Date(formData.start_date);
      const endDate = formData.end_date ? new Date(formData.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
      const formatGoogleDate = (date) => format(date, "yyyyMMdd'T'HHmmss");
      
      const url = new URL('https://calendar.google.com/calendar/render');
      url.searchParams.set('action', 'TEMPLATE');
      url.searchParams.set('text', formData.title);
      url.searchParams.set('dates', `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
      if (formData.description) url.searchParams.set('details', formData.description);
      if (formData.location) url.searchParams.set('location', formData.location);
      window.open(url.toString(), '_blank');
    }
    
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Event</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Contact Selection — Clients + Leads */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Client / Lead</label>
            <Select value={contactValue} onValueChange={handleContactChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client or lead..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact</SelectItem>
                {clients.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Clients</SelectLabel>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={`client:${client.id}`}>
                        <span className="font-medium">{client.name}</span>
                        {client.company && <span className="text-gray-500 ml-1">({client.company})</span>}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {leads.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Leads</SelectLabel>
                    {leads.map(lead => (
                      <SelectItem key={lead.id} value={`lead:${lead.id}`}>
                        <span className="font-medium">{lead.name}</span>
                        {lead.company && <span className="text-gray-500 ml-1">({lead.company})</span>}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Proposal Selection */}
          {formData.client_id && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Related Proposal</label>
              <Select value={formData.proposal_id || "none"} onValueChange={(v) => handleProposalChange(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a proposal to add services..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No proposal</SelectItem>
                  {proposals.filter(p => p.client_id === formData.client_id || p.client_name === clients.find(c => c.id === formData.client_id)?.name).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.client_name} - ${p.total_amount?.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Service Picker from Proposal */}
          {showServicePicker && selectedProposal && getProposalServices().length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select a service from this proposal:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {getProposalServices().map((service, idx) => {
                  const config = eventTypeConfig[service.type];
                  const ServiceIcon = config?.icon || Clock;
                  return (
                    <div
                      key={idx}
                      onClick={() => selectService(service)}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white border cursor-pointer hover:border-[#770142] hover:bg-[#770142]/5 transition-all"
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: config?.color || '#666' }}
                      >
                        <ServiceIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{service.name}</p>
                        <p className="text-xs text-gray-500">{config?.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 w-full"
                onClick={() => setShowServicePicker(false)}
              >
                Or create custom event
              </Button>
            </div>
          )}

          {/* Service Catalog Picker */}
          {!showServicePicker && !showCatalogPicker && catalogServices.filter(s => s.is_active !== false).length > 0 && (
            <div>
              <Button 
                variant="outline" 
                className="w-full justify-start text-left"
                onClick={() => setShowCatalogPicker(true)}
              >
                <Package className="w-4 h-4 mr-2" />
                Select from Service Catalog
              </Button>
            </div>
          )}

          {showCatalogPicker && (
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select from your service catalog:
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {['workshop', 'challenge', 'leadership', 'class', 'wellness_box'].map(category => {
                  const categoryServices = catalogServices.filter(s => s.category === category && s.is_active !== false);
                  if (categoryServices.length === 0) return null;
                  const categoryLabels = {
                    workshop: 'Workshops',
                    challenge: 'Challenges',
                    leadership: 'Leadership',
                    class: 'Classes',
                    wellness_box: 'Wellness Boxes'
                  };
                  return (
                    <div key={category}>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{categoryLabels[category]}</p>
                      {categoryServices.map(service => {
                        const categoryMap = { workshop: 'workshop', challenge: 'challenge', leadership: 'leadership', class: 'class', wellness_box: 'delivery' };
                        const config = eventTypeConfig[categoryMap[service.category]];
                        const ServiceIcon = config?.icon || Clock;
                        return (
                          <div
                            key={service.id}
                            onClick={() => selectCatalogService(service)}
                            className="flex items-center gap-3 p-2 rounded-lg bg-white border cursor-pointer hover:border-[#770142] hover:bg-[#770142]/5 transition-all mb-1"
                          >
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: config?.color || '#666' }}
                            >
                              <ServiceIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{service.name}</p>
                              <p className="text-xs text-gray-500">${service.price?.toLocaleString()} • {service.duration || 'N/A'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 w-full"
                onClick={() => setShowCatalogPicker(false)}
              >
                Or create custom event
              </Button>
            </div>
          )}

          {/* Manual Event Creation */}
          {!showServicePicker && !showCatalogPicker && (
            <>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Start *
                  </label>
                  <Input 
                    type={formData.all_day ? "date" : "datetime-local"}
                    value={formData.all_day ? formData.start_date.split('T')[0] : formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">
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

              {activePresenters.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    <Users className="w-4 h-4 inline mr-1" />
                    Presenter
                  </label>
                  <Select
                    value={formData.presenter_id || 'none'}
                    onValueChange={(v) => {
                      const p = activePresenters.find(x => x.id === v);
                      setFormData(prev => ({
                        ...prev,
                        presenter_id: v === 'none' ? '' : v,
                        presenter: p?.name || prev.presenter,
                        presenter_email: p?.email || prev.presenter_email
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
                </div>
              )}

              {formData.service_id && hasAssessments && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    <ClipboardCheck className="w-4 h-4 inline mr-1" />
                    Assessment at check-in
                  </label>
                  <Select
                    value={formData.assessment_timing || 'none'}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, assessment_timing: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No assessment</SelectItem>
                      <SelectItem value="baseline">Baseline (first session)</SelectItem>
                      <SelectItem value="endpoint">Endpoint (last session)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">
                    Attendees will be asked {selectedService.included_assessments.length === 1 ? '1 quick survey' : `${selectedService.included_assessments.length} quick surveys`} at check-in.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving || !formData.title} className="flex-1 bg-[#770142] hover:bg-[#5a0132]">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Event
                </Button>
                <Button 
                  onClick={handleSaveAndAddToGoogle} 
                  disabled={saving || !formData.title} 
                  variant="outline"
                  className="flex-1"
                >
                  <img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" className="w-4 h-4 mr-2" alt="" />
                  + Google
                </Button>
              </div>
            </>
          )}

          {/* Save buttons when service picker is active */}
          {(showServicePicker || showCatalogPicker) && formData.title && (
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#770142] hover:bg-[#5a0132]">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Event
              </Button>
              <Button 
                onClick={handleSaveAndAddToGoogle} 
                disabled={saving} 
                variant="outline"
                className="flex-1"
              >
                <img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" className="w-4 h-4 mr-2" alt="" />
                + Google
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}