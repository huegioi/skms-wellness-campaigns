import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { contactsUpdate } from '@/lib/clientContacts';
import AddContactDialog from '@/components/clients/AddContactDialog';

const TYPE_LABELS = {
  broker: 'Broker',
  wellness_consultant: 'Wellness Consultant',
  hr: 'HR',
  other: 'Other',
};

const TYPE_COLORS = {
  broker: 'bg-orange-100 text-orange-700',
  wellness_consultant: 'bg-purple-100 text-purple-700',
  hr: 'bg-blue-100 text-blue-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function ContactsCard({ client, onUpdate }) {
  const [showAddContact, setShowAddContact] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { contact, index }

  const contacts = client.related_contacts || [];

  // Primary first, then the rest in existing order.
  const indexed = contacts.map((contact, index) => ({ contact, index }));
  const sorted = [
    ...indexed.filter(({ contact }) => contact.is_primary),
    ...indexed.filter(({ contact }) => !contact.is_primary),
  ];

  const handleMakeMain = (contact) => {
    const updated = contacts.map(c => ({ ...c, is_primary: c === contact }));
    onUpdate(contactsUpdate(updated));
  };

  const handleDelete = (index) => {
    const updated = contacts.filter((_, i) => i !== index);
    onUpdate(contactsUpdate(updated));
  };

  const handleEdit = (contact, index) => {
    setEditTarget({ contact, index });
    setShowAddContact(true);
  };

  const handleAdd = () => {
    setEditTarget(null);
    setShowAddContact(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            Contacts ({contacts.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add contact
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          {sorted.length === 0 && (
            <p className="text-sm text-gray-400 italic py-2">No contacts yet.</p>
          )}
          {sorted.map(({ contact, index }) => (
            <div
              key={index}
              className="group flex items-start justify-between gap-2 rounded-lg border p-3 hover:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-gray-800">{contact.name || '(unnamed)'}</p>
                  {contact.is_primary && (
                    <Badge className="bg-[#013f7c] text-white">Main contact</Badge>
                  )}
                  {contact.contact_type && contact.contact_type !== 'other' && (
                    <Badge className={TYPE_COLORS[contact.contact_type] || TYPE_COLORS.other}>
                      {TYPE_LABELS[contact.contact_type] || contact.contact_type}
                    </Badge>
                  )}
                </div>
                {contact.title && <p className="text-sm text-gray-600">{contact.title}</p>}
                <div className="flex flex-col text-sm text-gray-500">
                  {contact.email && <p>{contact.email}</p>}
                  {contact.phone && <p>{contact.phone}</p>}
                </div>
                {contact.linked_partner_id && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" /> Linked referral partner
                  </p>
                )}
                {contact.notes && <p className="text-xs text-gray-400 mt-1">{contact.notes}</p>}
              </div>
              <div className="flex gap-1 items-start opacity-0 group-hover:opacity-100 transition-opacity">
                {!contact.is_primary && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                    onClick={() => handleMakeMain(contact)}
                  >
                    Make main
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(contact, index)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(index)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddContactDialog
        open={showAddContact}
        onOpenChange={setShowAddContact}
        client={client}
        onUpdate={onUpdate}
        contact={editTarget?.contact}
        index={editTarget?.index}
      />
    </>
  );
}