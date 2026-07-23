import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, X } from 'lucide-react';

const PRESET_EMAILS = [
  'william@skillfulmeans.life',
  'heather@skillfulmeans.life',
  'admin@skillfulmeans.life',
];

const SENDER_MODES = [
  { value: 'record_owner', label: 'Record owner', desc: 'Send from the team member who owns each record' },
  { value: 'william', label: 'All from William', desc: 'All emails drafted as william@skillfulmeans.life' },
  { value: 'heather', label: 'All from Heather', desc: 'All emails drafted as heather@skillfulmeans.life' },
];

export default function WizardStepSettings({ form, updateForm }) {
  const [customEmail, setCustomEmail] = useState('');

  const togglePreset = (email) => {
    if (form.cc_emails.includes(email)) {
      updateForm('cc_emails', form.cc_emails.filter(e => e !== email));
    } else {
      updateForm('cc_emails', [...form.cc_emails, email]);
    }
  };

  const addCustom = () => {
    const trimmed = customEmail.trim();
    if (trimmed && !form.cc_emails.includes(trimmed)) {
      updateForm('cc_emails', [...form.cc_emails, trimmed]);
      setCustomEmail('');
    }
  };

  const removeEmail = (email) => {
    updateForm('cc_emails', form.cc_emails.filter(e => e !== email));
  };

  return (
    <div className="space-y-5">
      {/* Sender mode */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Sender Mode</Label>
        <RadioGroup
          value={form.sender_mode}
          onValueChange={v => updateForm('sender_mode', v)}
          className="space-y-2"
        >
          {SENDER_MODES.map(m => (
            <div key={m.value} className="flex items-start gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer hover:bg-gray-50">
              <RadioGroupItem value={m.value} id={`sender-${m.value}`} className="mt-0.5" />
              <div>
                <label htmlFor={`sender-${m.value}`} className="text-sm font-medium cursor-pointer">{m.label}</label>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* CC emails */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">CC Emails</Label>
        <div className="space-y-2">
          {PRESET_EMAILS.map(email => (
            <div key={email} className="flex items-center gap-2">
              <Checkbox
                checked={form.cc_emails.includes(email)}
                onCheckedChange={() => togglePreset(email)}
              />
              <span className="text-sm text-gray-700">{email}</span>
            </div>
          ))}

          {/* Custom emails already added */}
          {form.cc_emails.filter(e => !PRESET_EMAILS.includes(e)).map(email => (
            <div key={email} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1">
              <span className="text-sm text-gray-700 flex-1">{email}</span>
              <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => removeEmail(email)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}

          {/* Add custom email */}
          <div className="flex gap-2">
            <Input
              placeholder="Add another email..."
              value={customEmail}
              onChange={e => setCustomEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addCustom} disabled={!customEmail.trim()}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}