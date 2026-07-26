import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Link as LinkIcon, X } from 'lucide-react';
import { toast } from 'sonner';

const CONTACT_TYPES = [
  { value: 'other', label: 'Other' },
  { value: 'broker', label: 'Broker' },
  { value: 'wellness_consultant', label: 'Wellness Consultant' },
  { value: 'hr', label: 'HR' },
];

const emptyForm = {
  name: '', email: '', phone: '', title: '', company: '', notes: '', contact_type: 'other'
};

export default function AddContactDialog({ open, onOpenChange, client, onUpdate }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedPartner, setLinkedPartner] = useState(null); // ReferralPartner linked
  const [saving, setSaving] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setSearchQuery('');
      setLinkedPartner(null);
    }
  }, [open]);

  const { data: allPartners = [] } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.filter({ is_active: true }, 'name'),
    enabled: open
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['brokerLeads'],
    queryFn: () => base44.entities.Lead.filter({ lead_type: 'broker_lead', is_archived: { $ne: true } }, 'name'),
    enabled: open
  });

  const isBrokerOrConsultant = form.contact_type === 'broker' || form.contact_type === 'wellness_consultant';

  // Combined search: look in referral partners + broker leads by name
  const searchResults = isBrokerOrConsultant && searchQuery.length >= 2
    ? [
        ...allPartners
          .filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(p => ({ ...p, _source: 'partner' })),
        ...allLeads
          .filter(l =>
            l.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !allPartners.find(p => p.id === l.referral_partner_id)
          )
          .map(l => ({ ...l, _source: 'lead' }))
      ]
    : [];

  const selectExisting = (result) => {
    setForm(prev => ({
      ...prev,
      name: result.name || '',
      email: result.email || '',
      phone: result.phone || '',
      title: result.title || '',
      company: result.company || '',
    }));
    setSearchQuery('');
    if (result._source === 'partner') {
      setLinkedPartner(result);
    }
  };

  const clearLink = () => {
    setLinkedPartner(null);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      // 1. Build the new contact entry
      const newContact = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        title: form.title,
        company: form.company,
        notes: form.notes,
        contact_type: form.contact_type,
        linked_partner_id: linkedPartner?.id || null,
      };

      // 2. Update client's related_contacts
      const updatedContacts = [...(client.related_contacts || []), newContact];

      // 3. If broker or consultant, also update the top-level fields on client
      const extraFields = {};
      if (form.contact_type === 'broker') {
        extraFields.broker_name = form.name;
        extraFields.broker_email = form.email;
      } else if (form.contact_type === 'wellness_consultant') {
        extraFields.wellness_consultant_name = form.name;
        extraFields.wellness_consultant_email = form.email;
      }

      // 4. If linked to a ReferralPartner, also set referral_partner fields
      if (linkedPartner) {
        extraFields.referral_partner_id = linkedPartner.id;
        extraFields.referral_partner_name = linkedPartner.name;
      }

      await onUpdate({ related_contacts: updatedContacts, ...extraFields });

      // 5. Always create a Referral record if broker/consultant type
      if (form.contact_type === 'broker' || form.contact_type === 'wellness_consultant') {
        const partnerId = linkedPartner?.id;
        // If no linked partner, try to find or create one based on name
        let finalPartnerId = partnerId;

        if (!finalPartnerId) {
          // Create a new referral partner record
          const newPartner = await base44.entities.ReferralPartner.create({
            name: form.name,
            email: form.email,
            phone: form.phone,
            company: form.company,
            unique_portal_id: `portal_${Date.now()}`,
            is_active: true,
          });
          finalPartnerId = newPartner.id;
        }

        // Create the referral linking this client to the partner
        await base44.entities.Referral.create({
          referral_partner_id: finalPartnerId,
          referral_partner_name: form.name,
          referred_client_id: client.id,
          contact_name: client.name,
          contact_email: client.email,
          company_name: client.company || '',
          notes: `Added via Contacts tab for client: ${client.company || client.name}`,
          referral_date: new Date().toISOString(),
          status: 'converted_to_client',
        });

        queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      }

      toast.success('Contact added successfully');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to add contact: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Contact Type */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-semibold">Contact Type</label>
            <Select
              value={form.contact_type}
              onValueChange={(v) => { setForm({ ...form, contact_type: v }); setLinkedPartner(null); setSearchQuery(''); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search/Link for broker or wellness consultant */}
          {isBrokerOrConsultant && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-semibold">
                Search existing {form.contact_type === 'broker' ? 'broker' : 'consultant'} in system
              </label>
              {linkedPartner ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <LinkIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900">{linkedPartner.name}</p>
                    {linkedPartner.company && <p className="text-xs text-green-700">{linkedPartner.company}</p>}
                  </div>
                  <button onClick={clearLink} className="text-green-600 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Type name to search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((r) => (
                        <button
                          key={r.id}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                          onClick={() => selectExisting(r)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{r.name}</p>
                              {r.company && <p className="text-xs text-gray-500">{r.company}</p>}
                              {r.email && <p className="text-xs text-gray-400">{r.email}</p>}
                            </div>
                            <Badge className={r._source === 'partner' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                              {r._source === 'partner' ? 'Partner' : 'Lead'}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contact Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Name *</label>
              <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <Input placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Company</label>
              <Input placeholder="Company name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <Input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <Input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <Textarea placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          {isBrokerOrConsultant && (
            <p className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-lg p-2">
              A referral record linking this client to the {form.contact_type === 'broker' ? 'broker' : 'consultant'} will be created automatically.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={!form.name || saving}
              className="flex-1 bg-[#264d44] hover:bg-[#1a3830]"
            >
              {saving ? 'Saving...' : 'Add Contact'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}