import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function PrimaryContactEditor({ client, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: client.name || '',
    email: client.email || '',
    title: client.title || '',
    phone: client.phone || '',
  });

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.error('Name and email are required');
      return;
    }
    await onUpdate(form);
    toast.success('Primary contact updated');
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({
      name: client.name || '',
      email: client.email || '',
      title: client.title || '',
      phone: client.phone || '',
    });
    setEditing(false);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <Badge className="bg-blue-100 text-blue-700 mb-2">Primary Contact</Badge>
        {!editing && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 text-gray-500" />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Contact name" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email *</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Job Title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Job title" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="bg-[#264d44] hover:bg-[#1a3830]" onClick={handleSave}>
              <Check className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="font-semibold">{client.name}</p>
          {client.title && <p className="text-sm text-gray-600">{client.title}</p>}
          <p className="text-sm text-gray-500">{client.email}</p>
          {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
        </div>
      )}
    </div>
  );
}