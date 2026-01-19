import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Mail, Upload, Send, FileText, Search, Filter, X } from 'lucide-react';
import { productCatalog } from '@/components/curriculum/catalogData';

export default function EmailTemplateManager() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [sendingTo, setSendingTo] = useState(null);
  const [sendEmail, setSendEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [activeCategory, setActiveCategory] = useState('workshop');
  
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list('service_category')
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.filter({ status: 'accepted' })
  });

  const [formData, setFormData] = useState({
    service_name: '',
    service_category: 'workshop',
    template_type: 'announcement',
    subject: '',
    body: '',
    file_url: ''
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setShowDialog(false);
      setEditingTemplate(null);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emailTemplates'] })
  });

  const resetForm = () => {
    setFormData({
      service_name: '',
      service_category: 'workshop',
      template_type: 'announcement',
      subject: '',
      body: '',
      file_url: ''
    });
  };

  const handleEdit = (template) => {
    setFormData({
      service_name: template.service_name || '',
      service_category: template.service_category || 'workshop',
      template_type: template.template_type || 'announcement',
      subject: template.subject || '',
      body: template.body || '',
      file_url: template.file_url || ''
    });
    setEditingTemplate(template);
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSendToClient = async () => {
    if (!sendingTo || !sendEmail) return;
    
    await base44.integrations.Core.SendEmail({
      to: sendEmail,
      subject: sendingTo.subject,
      body: sendingTo.body || 'Please find your email template attached.'
    });
    
    setSendingTo(null);
    setSendEmail('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, file_url });
    }
  };

  // Get all available services from catalog
  const getAllServices = () => {
    const services = [];
    Object.entries(productCatalog.workshops).forEach(([key, w]) => 
      services.push({ key, name: w.name, category: 'workshop' }));
    Object.entries(productCatalog.challenges).forEach(([key, c]) => 
      services.push({ key, name: c.name, category: 'challenge' }));
    Object.entries(productCatalog.leadership).forEach(([key, l]) => 
      services.push({ key, name: l.name, category: 'leadership' }));
    Object.entries(productCatalog.movementClasses).forEach(([key, m]) => 
      services.push({ key, name: m.name, category: 'class' }));
    return services;
  };

  const allServices = getAllServices();

  const templateTypeLabels = {
    announcement: 'Announcement (2 weeks before)',
    reminder_2weeks: '2-Week Reminder',
    reminder_2days: '2-Day Reminder',
    follow_up: 'Post-Event Follow-up'
  };

  const categoryLabels = {
    workshop: 'Workshops',
    challenge: 'Challenges',
    leadership: 'Leadership',
    class: 'Classes',
    wellness_box: 'Wellness Boxes'
  };

  // Filter templates based on search and type filter
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !searchQuery || 
        t.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.template_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [templates, searchQuery, filterType]);

  // Group filtered templates by category
  const templatesByCategory = {
    workshop: filteredTemplates.filter(t => t.service_category === 'workshop'),
    challenge: filteredTemplates.filter(t => t.service_category === 'challenge'),
    leadership: filteredTemplates.filter(t => t.service_category === 'leadership'),
    class: filteredTemplates.filter(t => t.service_category === 'class'),
    wellness_box: filteredTemplates.filter(t => t.service_category === 'wellness_box')
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
  };

  const hasActiveFilters = searchQuery || filterType !== 'all';

  if (isLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Email Templates</h1>
            <p className="text-gray-600">Manage email templates for services</p>
          </div>
          <Button onClick={() => { resetForm(); setShowDialog(true); }} className="bg-[#770142] hover:bg-[#5a0132]">
            <Plus className="w-4 h-4 mr-2" /> Add Template
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Search by service name or subject..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Template Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="reminder_2weeks">2-Week Reminder</SelectItem>
                    <SelectItem value="reminder_2days">2-Day Reminder</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>
            
            {hasActiveFilters && (
              <div className="mt-3 text-sm text-gray-500">
                Showing {filteredTemplates.length} of {templates.length} templates
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="mb-6">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label} ({templatesByCategory[key]?.length || 0})
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(categoryLabels).map(([category, label]) => (
            <TabsContent key={category} value={category}>
              {templatesByCategory[category]?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No templates for {label}</h3>
                    <p className="text-gray-500">Create your first template for this category.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {templatesByCategory[category].map(template => (
                    <Card key={template.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-800">{template.service_name}</h3>
                              <Badge variant="outline">
                                {templateTypeLabels[template.template_type]}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              <strong>Subject:</strong> {template.subject}
                            </p>
                            {template.body && (
                              <p className="text-sm text-gray-500 line-clamp-2">
                                {template.body.replace(/<[^>]*>/g, '').substring(0, 200)}...
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSendingTo(template)}
                            >
                              <Send className="w-4 h-4 mr-1" /> Send
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(template)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(template.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditingTemplate(null); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Email Template'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Service</label>
                  <Select value={formData.service_name} onValueChange={(v) => {
                    const service = allServices.find(s => s.name === v);
                    setFormData({ ...formData, service_name: v, service_category: service?.category || 'workshop' });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                    <SelectContent>
                      {allServices.map(s => (
                        <SelectItem key={s.key} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Template Type</label>
                  <Select value={formData.template_type} onValueChange={(v) => setFormData({ ...formData, template_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="announcement">Announcement (2 weeks before)</SelectItem>
                      <SelectItem value="reminder_2weeks">2-Week Reminder</SelectItem>
                      <SelectItem value="reminder_2days">2-Day Reminder</SelectItem>
                      <SelectItem value="follow_up">Post-Event Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Subject Line *</label>
                <Input 
                  value={formData.subject} 
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Email subject..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email Body</label>
                <Textarea 
                  value={formData.body} 
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Write your email content here..."
                  rows={8}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Upload Template File (Optional)</label>
                <Input type="file" onChange={handleFileUpload} accept=".txt,.doc,.docx,.pdf,.eml" />
                {formData.file_url && (
                  <p className="text-sm text-green-600 mt-1">File uploaded successfully</p>
                )}
              </div>

              <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Send to Client Dialog */}
        <Dialog open={!!sendingTo} onOpenChange={(open) => !open && setSendingTo(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Template to Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Send "{sendingTo?.subject}" to a client
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Client Email</label>
                <Input 
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="client@company.com"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSendingTo(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleSendToClient} className="flex-1 bg-[#770142] hover:bg-[#5a0132]">
                  <Send className="w-4 h-4 mr-2" /> Send Email
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}