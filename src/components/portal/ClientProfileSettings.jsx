import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building, User, Mail, Phone, DollarSign, Users, Briefcase, Save, CheckCircle } from 'lucide-react';

export default function ClientProfileSettings({ client, onUpdate }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    industry: '',
    company_size: '',
    wellness_budget: '',
    notes: ''
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        industry: client.industry || '',
        company_size: client.company_size || '',
        wellness_budget: client.wellness_budget || '',
        notes: client.notes || ''
      });
    }
  }, [client]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.update(client.id, data),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onUpdate?.();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      wellness_budget: formData.wellness_budget ? parseFloat(formData.wellness_budget) : null
    });
  };

  const companySizeOptions = [
    { value: '1-50', label: '1-50 employees' },
    { value: '51-200', label: '51-200 employees' },
    { value: '201-500', label: '201-500 employees' },
    { value: '501-1000', label: '501-1000 employees' },
    { value: '1001-5000', label: '1001-5000 employees' },
    { value: '5000+', label: '5000+ employees' }
  ];

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        {/* Contact Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#013f7c' }}>
              <User className="w-5 h-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Full Name
                </label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number
                </label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#264d44' }}>
              <Building className="w-5 h-5" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <Building className="w-4 h-4 inline mr-1" />
                  Company Name
                </label>
                <Input 
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Your company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <Briefcase className="w-4 h-4 inline mr-1" />
                  Industry
                </label>
                <Input 
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g., Healthcare, Technology, Finance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  Company Size
                </label>
                <Select 
                  value={formData.company_size} 
                  onValueChange={(v) => setFormData({ ...formData, company_size: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    {companySizeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Annual Wellness Budget
                </label>
                <Input 
                  type="number"
                  value={formData.wellness_budget}
                  onChange={(e) => setFormData({ ...formData, wellness_budget: e.target.value })}
                  placeholder="e.g., 50000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: '#770142' }}>
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information about your wellness program needs..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          {saved && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span>Changes saved!</span>
            </div>
          )}
          <Button 
            type="submit" 
            disabled={updateMutation.isPending}
            className="bg-[#264d44] hover:bg-[#1a3830]"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}