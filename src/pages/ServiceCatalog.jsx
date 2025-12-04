import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Pencil, Trash2, Award, Dumbbell, Package, Users, Clock,
  DollarSign, Target, Loader2, GripVertical
} from 'lucide-react';

const categoryConfig = {
  workshop: { label: 'Workshops', color: '#264d44', icon: Award },
  challenge: { label: '14-Day Challenges', color: '#ff9878', icon: Dumbbell },
  leadership: { label: 'Leadership Programs', color: '#770142', icon: Users },
  class: { label: 'Classes', color: '#013f7c', icon: Dumbbell },
  wellness_box: { label: 'Wellness Boxes', color: '#eaf995', icon: Package }
};

export default function ServiceCatalog() {
  const [activeTab, setActiveTab] = useState('workshop');
  const [editingService, setEditingService] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (data.id) {
        return base44.entities.Service.update(data.id, data);
      }
      return base44.entities.Service.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowDialog(false);
      setEditingService(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] })
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Service.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] })
  });

  const filteredServices = services.filter(s => s.category === activeTab);

  const openNewService = () => {
    setEditingService({ 
      category: activeTab, 
      is_active: true,
      price: 0,
      duration_hours: 1,
      key_benefits: []
    });
    setShowDialog(true);
  };

  const openEditService = (service) => {
    setEditingService({ ...service });
    setShowDialog(true);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Service Catalog</h1>
            <p className="text-gray-600">Manage your workshops, challenges, and programs</p>
          </div>
          <Button onClick={openNewService} className="bg-[#770142] hover:bg-[#5a0132]">
            <Plus className="w-4 h-4 mr-2" /> Add Service
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white shadow-md mb-6 flex-wrap h-auto p-1">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const Icon = config.icon;
              const count = services.filter(s => s.category === key).length;
              return (
                <TabsTrigger 
                  key={key} 
                  value={key}
                  className="flex items-center gap-2 data-[state=active]:bg-[#264d44] data-[state=active]:text-white"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{config.label}</span>
                  <Badge variant="secondary" className="ml-1">{count}</Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.keys(categoryConfig).map(cat => (
            <TabsContent key={cat} value={cat}>
              {filteredServices.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No services yet</h3>
                  <p className="text-gray-500 mb-4">Add your first {categoryConfig[cat].label.toLowerCase()}</p>
                  <Button onClick={openNewService} className="bg-[#770142] hover:bg-[#5a0132]">
                    <Plus className="w-4 h-4 mr-2" /> Add Service
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredServices.map(service => {
                    const config = categoryConfig[service.category];
                    const Icon = config.icon;
                    return (
                      <div 
                        key={service.id} 
                        className={`bg-white rounded-xl shadow-lg p-5 ${!service.is_active ? 'opacity-60' : ''}`}
                      >
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex gap-4 flex-1">
                            <div 
                              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: config.color }}
                            >
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-bold" style={{ color: '#264d44' }}>
                                  {service.name}
                                </h3>
                                {!service.is_active && (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm mb-2">
                                {service.short_description || service.description?.slice(0, 150)}
                              </p>
                              <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-4 h-4" />
                                  ${service.price?.toLocaleString()}
                                  {service.price_label && <span className="text-xs">({service.price_label})</span>}
                                </span>
                                {service.duration && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {service.duration}
                                  </span>
                                )}
                                {service.target_audience && (
                                  <span className="flex items-center gap-1">
                                    <Target className="w-4 h-4" />
                                    {service.target_audience}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 mr-4">
                              <span className="text-sm text-gray-500">Active</span>
                              <Switch 
                                checked={service.is_active !== false}
                                onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: service.id, is_active: checked })}
                              />
                            </div>
                            <Button size="icon" variant="outline" onClick={() => openEditService(service)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-red-500"
                              onClick={() => {
                                if (confirm('Delete this service?')) {
                                  deleteMutation.mutate(service.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Service Edit Dialog */}
        <ServiceEditDialog 
          service={editingService}
          open={showDialog}
          onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) setEditingService(null);
          }}
          onSave={(data) => saveMutation.mutate(data)}
          saving={saveMutation.isPending}
        />
      </div>
    </div>
  );
}

function ServiceEditDialog({ service, open, onOpenChange, onSave, saving }) {
  const [formData, setFormData] = useState(service || {});
  const [benefitInput, setBenefitInput] = useState('');

  React.useEffect(() => {
    if (service) {
      setFormData(service);
    }
  }, [service]);

  const handleSave = () => {
    onSave(formData);
  };

  const addBenefit = () => {
    if (benefitInput.trim()) {
      setFormData(prev => ({
        ...prev,
        key_benefits: [...(prev.key_benefits || []), benefitInput.trim()]
      }));
      setBenefitInput('');
    }
  };

  const removeBenefit = (index) => {
    setFormData(prev => ({
      ...prev,
      key_benefits: prev.key_benefits.filter((_, i) => i !== index)
    }));
  };

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service.id ? 'Edit Service' : 'Add New Service'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Category *</label>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Service Name *</label>
            <Input 
              value={formData.name || ''} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Stress Management Workshop"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Short Description</label>
            <Input 
              value={formData.short_description || ''} 
              onChange={(e) => setFormData({...formData, short_description: e.target.value})}
              placeholder="Brief one-line description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Full Description</label>
            <Textarea 
              value={formData.description || ''} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Detailed description of the service..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Price *</label>
              <Input 
                type="number"
                value={formData.price || ''} 
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Price Label</label>
              <Input 
                value={formData.price_label || ''} 
                onChange={(e) => setFormData({...formData, price_label: e.target.value})}
                placeholder="e.g., per session"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Duration</label>
              <Input 
                value={formData.duration || ''} 
                onChange={(e) => setFormData({...formData, duration: e.target.value})}
                placeholder="e.g., 1 hour, 14 days"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Duration (hours)</label>
              <Input 
                type="number"
                value={formData.duration_hours || ''} 
                onChange={(e) => setFormData({...formData, duration_hours: parseFloat(e.target.value) || 0})}
                placeholder="For calendar events"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Target Audience</label>
            <Input 
              value={formData.target_audience || ''} 
              onChange={(e) => setFormData({...formData, target_audience: e.target.value})}
              placeholder="e.g., All employees, Leadership team"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Key Benefits</label>
            <div className="flex gap-2 mb-2">
              <Input 
                value={benefitInput} 
                onChange={(e) => setBenefitInput(e.target.value)}
                placeholder="Add a benefit..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
              />
              <Button type="button" variant="outline" onClick={addBenefit}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(formData.key_benefits || []).map((benefit, idx) => (
                <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeBenefit(idx)}>
                  {benefit} ×
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Sort Order</label>
            <Input 
              type="number"
              value={formData.sort_order || 0} 
              onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 0})}
            />
          </div>

          <Button onClick={handleSave} disabled={saving || !formData.name} className="w-full bg-[#770142] hover:bg-[#5a0132]">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving...' : (service.id ? 'Update Service' : 'Create Service')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}