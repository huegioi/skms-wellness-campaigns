import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ChevronLeft, ScanText, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM = {
  name: '',
  email: '',
  company: '',
  title: '',
  phone: '',
  notes: '',
  source: '',
  outreach_channel: 'linkedin',
  status: 'cold',
  lead_type: 'broker_lead',
  partner_status: 'new',
  referral_potential: 'medium',
};

export default function AddLead() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [scannedText, setScannedText] = useState('');
  const [saved, setSaved] = useState(false);

  const createLeadMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setForm(EMPTY_FORM);
      setScannedText('');
      toast.success('Lead saved to database!');
    },
    onError: (error) => {
      toast.error('Failed to add lead: ' + error.message);
    },
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const parseScannedText = () => {
    if (!scannedText.trim()) return;
    const text = scannedText;
    const newForm = { ...form };

    // Email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) newForm.email = emailMatch[1];

    // Phone
    const phoneMatch = text.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
    if (phoneMatch) newForm.phone = phoneMatch[1];

    // Name — first line that looks like two capitalized words
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const nameMatch = line.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/);
      if (nameMatch && !emailMatch?.[0].includes(line)) {
        newForm.name = nameMatch[1];
        break;
      }
    }

    // Company — look for LLC, Inc, Corp, Group etc.
    const companyMatch = text.match(/([A-Z][a-zA-Z0-9\s&.,'-]+(?:LLC|Inc\.?|Corp\.?|Ltd\.?|Group|Solutions|Advisors|Partners|Associates|Agency|Services|Benefits|Consulting))/);
    if (companyMatch) newForm.company = companyMatch[1].trim();

    // Title — common title keywords
    const titleMatch = text.match(/(VP|Vice President|Director|Manager|President|Owner|Founder|Broker|Advisor|Consultant|Agent|Principal|Partner|Associate|Executive|Officer|Specialist)[^\n,]*/i);
    if (titleMatch) newForm.title = titleMatch[0].trim();

    setForm(newForm);
    toast.info('Form auto-filled — please review and confirm.');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error('Name and Email are required.');
      return;
    }
    createLeadMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/Leads')} className="p-2">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-[#013f7c] leading-tight">Quick Lead Capture</h1>
          <p className="text-xs text-gray-500">Saves directly to your Broker Leads database</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-5 pb-10">

        {/* Scan / Paste Section */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ScanText className="w-5 h-5 text-[#013f7c]" />
            <h2 className="font-semibold text-gray-800">Paste / Scan Business Card Text</h2>
          </div>
          <Textarea
            placeholder="Paste text from a business card or QR code here and tap Auto-Fill..."
            value={scannedText}
            onChange={e => setScannedText(e.target.value)}
            rows={4}
            className="text-sm"
          />
          <Button
            type="button"
            onClick={parseScannedText}
            disabled={!scannedText.trim()}
            variant="outline"
            className="w-full border-[#013f7c] text-[#013f7c] hover:bg-[#013f7c] hover:text-white"
          >
            Auto-Fill from Text
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-4 space-y-4">
          <h2 className="font-semibold text-gray-800">Contact Details</h2>

          <div className="space-y-1">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input id="email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@brokerco.com" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Broker Co LLC" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={e => set('title', e.target.value)} placeholder="VP Benefits" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="source">Where did you meet?</Label>
            <Input id="source" value={form.source} onChange={e => set('source', e.target.value)} placeholder="e.g., SHRM Conference 2026" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Referral Potential</Label>
              <Select value={form.referral_potential} onValueChange={v => set('referral_potential', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select value={form.outreach_channel} onValueChange={v => set('outreach_channel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['email', 'linkedin', 'phone', 'referral', 'other'].map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Quick notes about this person..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className={`w-full text-base py-5 font-semibold transition-all ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-[#013f7c] hover:bg-[#012d5a]'}`}
            disabled={createLeadMutation.isPending}
          >
            {createLeadMutation.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle2 className="w-5 h-5 mr-2" /> Saved!</>
            ) : (
              <><Save className="w-5 h-5 mr-2" /> Save Lead</>
            )}
          </Button>
        </form>

        {/* Quick nav back */}
        <button
          onClick={() => navigate('/Leads')}
          className="w-full text-center text-sm text-[#013f7c] hover:underline py-2"
        >
          View all leads →
        </button>
      </div>
    </div>
  );
}