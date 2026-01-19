import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Mail, Upload, Send, FileText, Search, Filter, X, Eye, Copy, History, Tag } from 'lucide-react';
import { productCatalog } from '@/components/curriculum/catalogData';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function EmailTemplateManager() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [sendingTo, setSendingTo] = useState(null);
  const [sendEmail, setSendEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [activeCategory, setActiveCategory] = useState('workshop');
  const [editorTab, setEditorTab] = useState('edit');
  const quillRef = useRef(null);
  
  const queryClient = useQueryClient();

  const placeholders = [
    { label: 'Client Name', value: '{{client_name}}' },
    { label: 'Company Name', value: '{{company}}' },
    { label: 'Invoice Amount', value: '{{invoice_amount}}' },
    { label: 'Invoice Number', value: '{{invoice_number}}' },
    { label: 'Service Name', value: '{{service_name}}' },
    { label: 'Event Date', value: '{{event_date}}' },
    { label: 'Event Time', value: '{{event_time}}' },
    { label: 'Event Location', value: '{{event_location}}' },
    { label: 'Event Link', value: '{{event_link}}' }
  ];

  const insertPlaceholder = (placeholder) => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      const cursorPosition = editor.getSelection()?.index || 0;
      editor.insertText(cursorPosition, placeholder);
      editor.setSelection(cursorPosition + placeholder.length);
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ]
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'align',
    'link'
  ];

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list('service_category')
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.filter({ status: 'accepted' })
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const getPreviewData = () => {
    if (previewClientId) {
      const client = clients.find(c => c.id === previewClientId);
      const clientEvent = events.find(e => e.client_id === previewClientId);
      
      return {
        client_name: client?.name || 'Jane Doe',
        company: client?.company || 'Acme Corp',
        invoice_amount: '$1,500',
        invoice_number: 'INV-001',
        service_name: formData.service_name || 'Wellness Workshop',
        event_date: clientEvent?.start_date ? new Date(clientEvent.start_date).toLocaleDateString() : 'Jan 25, 2026',
        event_time: clientEvent?.start_date ? new Date(clientEvent.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '2:00 PM',
        event_location: clientEvent?.location || 'Main Conference Room',
        event_link: clientEvent?.location?.includes('http') ? clientEvent.location : 'https://zoom.us/j/example123'
      };
    }
    
    return {
      client_name: 'Jane Doe',
      company: 'Acme Corp',
      invoice_amount: '$1,500',
      invoice_number: 'INV-001',
      service_name: formData.service_name || 'Wellness Workshop',
      event_date: 'Jan 25, 2026',
      event_time: '2:00 PM',
      event_location: 'Main Conference Room',
      event_link: 'https://zoom.us/j/example123'
    };
  };

  const [formData, setFormData] = useState({
    service_name: '',
    service_category: 'workshop',
    template_type: 'announcement',
    subject: '',
    body: '',
    file_url: '',
    tags: [],
    client_id: '',
    version: 1
  });
  
  const [newTag, setNewTag] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedVersionTemplate, setSelectedVersionTemplate] = useState(null);
  const [previewClientId, setPreviewClientId] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Get the current template to save version history
      const currentTemplate = templates.find(t => t.id === id);
      
      if (currentTemplate) {
        const versionHistory = currentTemplate.version_history || [];
        versionHistory.push({
          version: currentTemplate.version || 1,
          subject: currentTemplate.subject,
          body: currentTemplate.body,
          updated_date: new Date().toISOString(),
          updated_by: (await base44.auth.me()).email
        });

        const updatedData = {
          ...data,
          version: (currentTemplate.version || 1) + 1,
          version_history: versionHistory
        };

        return base44.entities.EmailTemplate.update(id, updatedData);
      }

      return base44.entities.EmailTemplate.update(id, data);
    },
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
      file_url: '',
      tags: [],
      client_id: '',
      version: 1
    });
    setNewTag('');
    setEditorTab('edit');
  };

  const handleEdit = (template) => {
    setFormData({
      service_name: template.service_name || '',
      service_category: template.service_category || 'workshop',
      template_type: template.template_type || 'announcement',
      subject: template.subject || '',
      body: template.body || '',
      file_url: template.file_url || '',
      tags: template.tags || [],
      client_id: template.client_id || '',
      version: template.version || 1
    });
    setEditingTemplate(template);
    setShowDialog(true);
  };

  const handleDuplicate = (template) => {
    setFormData({
      service_name: template.service_name || '',
      service_category: template.service_category || 'workshop',
      template_type: template.template_type || 'announcement',
      subject: `${template.subject} (Copy)`,
      body: template.body || '',
      file_url: template.file_url || '',
      tags: template.tags || [],
      client_id: template.client_id || '',
      version: 1
    });
    setEditingTemplate(null);
    setShowDialog(true);
  };

  const handleRevertToVersion = async (template, versionData) => {
    await updateMutation.mutateAsync({
      id: template.id,
      data: {
        ...template,
        subject: versionData.subject,
        body: versionData.body
      }
    });
    setShowVersionHistory(false);
    setSelectedVersionTemplate(null);
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
      setUploadingFile(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // Parse the file to extract subject and body
        const parseResponse = await base44.functions.invoke('parseEmailFile', { file_url });
        
        console.log('Parse response:', parseResponse);
        
        const parsedSubject = parseResponse.data?.subject || '';
        const parsedBody = parseResponse.data?.body || '';
        
        if (parsedSubject || parsedBody) {
          setFormData({
            ...formData,
            subject: parsedSubject || formData.subject,
            body: parsedBody || formData.body,
            file_url
          });
          setEditorKey(prev => prev + 1); // Force editor to re-render with new content
          alert(`Content extracted successfully!\nSubject: ${parsedSubject ? '✓' : '✗'}\nBody: ${parsedBody ? '✓' : '✗'}`);
        } else {
          setFormData({ ...formData, file_url });
          alert('File uploaded but no content could be extracted. You can manually enter the template content.');
        }
      } catch (error) {
        console.error('File upload error:', error);
        alert(`Failed to parse file: ${error.message}`);
      } finally {
        setUploadingFile(false);
      }
    }
  };

  const addTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData({ ...formData, tags: [...formData.tags, newTag] });
      setNewTag('');
    }
  };

  const removeTag = (tag) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
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
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold text-gray-800">{template.service_name}</h3>
                              <Badge variant="outline">
                                {templateTypeLabels[template.template_type]}
                              </Badge>
                              {template.tags?.map(tag => (
                                <Badge key={tag} className="bg-blue-100 text-blue-700">
                                  <Tag className="w-3 h-3 mr-1" /> {tag}
                                </Badge>
                              ))}
                              {template.client_id && (
                                <Badge className="bg-purple-100 text-purple-700">
                                  Client-Specific
                                </Badge>
                              )}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setViewingTemplate(template)}
                            >
                              <Eye className="w-4 h-4 mr-1" /> View
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDuplicate(template)}
                            >
                              <Copy className="w-4 h-4 mr-1" /> Duplicate
                            </Button>
                            {template.version_history?.length > 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedVersionTemplate(template);
                                  setShowVersionHistory(true);
                                }}
                              >
                                <History className="w-4 h-4 mr-1" /> v{template.version}
                              </Button>
                            )}
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
                <label className="block text-sm font-medium text-gray-600 mb-2">Email Body</label>
                
                <Tabs value={editorTab} onValueChange={setEditorTab} className="w-full">
                  <TabsList className="mb-2">
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>

                  <TabsContent value="edit" className="mt-0">
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-2">Insert placeholders:</p>
                      <div className="flex flex-wrap gap-2">
                        {placeholders.map(p => (
                          <Button
                            key={p.value}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => insertPlaceholder(p.value)}
                            className="text-xs"
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <ReactQuill
                      key={editorKey}
                      ref={quillRef}
                      theme="snow"
                      value={formData.body}
                      onChange={(content) => setFormData({ ...formData, body: content })}
                      modules={modules}
                      formats={formats}
                      placeholder="Write your email content here..."
                      className="bg-white rounded-md"
                      style={{ height: '300px', marginBottom: '50px' }}
                    />
                  </TabsContent>

                  <TabsContent value="preview" className="mt-0">
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Preview with Client Data (Optional)
                      </label>
                      <Select value={previewClientId} onValueChange={setPreviewClientId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Use sample data" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Sample Data</SelectItem>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name} {client.company ? `(${client.company})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="border rounded-lg p-6 bg-white min-h-[300px]">
                      <div className="mb-4 pb-4 border-b">
                        <p className="text-sm text-gray-500">Subject:</p>
                        <p className="font-semibold text-gray-900">{formData.subject || 'No subject'}</p>
                      </div>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: formData.body
                            .replace(/{{client_name}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().client_name}</span>`)
                            .replace(/{{company}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().company}</span>`)
                            .replace(/{{invoice_amount}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().invoice_amount}</span>`)
                            .replace(/{{invoice_number}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().invoice_number}</span>`)
                            .replace(/{{service_name}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().service_name}</span>`)
                            .replace(/{{event_date}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().event_date}</span>`)
                            .replace(/{{event_time}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().event_time}</span>`)
                            .replace(/{{event_location}}/g, `<span class="bg-yellow-100 px-1 rounded">${getPreviewData().event_location}</span>`)
                            .replace(/{{event_link}}/g, `<span class="bg-yellow-100 px-1 rounded"><a href="${getPreviewData().event_link}" target="_blank">${getPreviewData().event_link}</a></span>`)
                        }}
                      />
                      {!formData.body && (
                        <p className="text-gray-400 italic">No content to preview</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Upload Template File (Optional)
                  <span className="text-xs text-gray-500 ml-2">Supports .eml, .txt, .doc, .docx, .pdf</span>
                </label>
                <Input 
                  type="file" 
                  onChange={handleFileUpload} 
                  accept=".txt,.doc,.docx,.pdf,.eml" 
                  disabled={uploadingFile}
                />
                {uploadingFile && (
                  <p className="text-sm text-blue-600 mt-1">Parsing file...</p>
                )}
                {formData.file_url && !uploadingFile && (
                  <p className="text-sm text-green-600 mt-1">✓ File uploaded and content extracted</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Client (Optional)</label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None - General template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None - General template</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.company ? `(${client.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Tags</label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map(tag => (
                      <Badge key={tag} className="bg-blue-100 text-blue-700">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Template Dialog */}
        <Dialog open={!!viewingTemplate} onOpenChange={(open) => !open && setViewingTemplate(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>View Template</DialogTitle>
            </DialogHeader>
            {viewingTemplate && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Service</label>
                    <p className="text-gray-900">{viewingTemplate.service_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
                    <p className="text-gray-900">{categoryLabels[viewingTemplate.service_category]}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Template Type</label>
                  <p className="text-gray-900">{templateTypeLabels[viewingTemplate.template_type]}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Subject Line</label>
                  <p className="text-gray-900 font-medium">{viewingTemplate.subject}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email Body</label>
                  <div 
                    className="border rounded-lg p-4 bg-gray-50 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: viewingTemplate.body || '<span class="text-gray-400 italic">No body content</span>' }}
                  />
                </div>

                {viewingTemplate.file_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Attached File</label>
                    <a 
                      href={viewingTemplate.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      View attached file
                    </a>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setViewingTemplate(null);
                      handleEdit(viewingTemplate);
                    }}
                    className="flex-1"
                  >
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button onClick={() => setViewingTemplate(null)} className="flex-1">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Version History Dialog */}
        <Dialog open={showVersionHistory} onOpenChange={(open) => !open && (setShowVersionHistory(false), setSelectedVersionTemplate(null))}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Version History - {selectedVersionTemplate?.service_name}</DialogTitle>
            </DialogHeader>
            {selectedVersionTemplate && (
              <div className="space-y-4 mt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-green-800">Current Version {selectedVersionTemplate.version}</h4>
                    <Badge className="bg-green-600">Active</Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-1"><strong>Subject:</strong> {selectedVersionTemplate.subject}</p>
                  <div 
                    className="text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedVersionTemplate.body?.substring(0, 200) + '...' }}
                  />
                </div>

                <h4 className="font-semibold text-gray-700 pt-4 border-t">Previous Versions</h4>
                {selectedVersionTemplate.version_history?.length > 0 ? (
                  <div className="space-y-3">
                    {[...selectedVersionTemplate.version_history].reverse().map((version, idx) => (
                      <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-800">Version {version.version}</h4>
                            <p className="text-xs text-gray-500">
                              {new Date(version.updated_date).toLocaleString()} by {version.updated_by}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRevertToVersion(selectedVersionTemplate, version)}
                          >
                            Revert to this version
                          </Button>
                        </div>
                        <p className="text-sm text-gray-700 mb-1"><strong>Subject:</strong> {version.subject}</p>
                        <div 
                          className="text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: version.body?.substring(0, 200) + '...' }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No previous versions</p>
                )}
              </div>
            )}
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