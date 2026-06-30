import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ChevronLeft, ScanText, Loader2, CheckCircle2, Camera, Linkedin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagSelector } from '@/components/ui/TagSelector';
import { toast } from 'sonner';

const EMPTY_FORM = {
  name: '',
  email: '',
  company: '',
  title: '',
  phone: '',
  address: '',
  notes: '',
  source: '',
  outreach_channel: 'linkedin',
  status: 'cold',
  lead_type: 'broker_lead',
  partner_status: 'new',
  referral_potential: 'medium',
  owner: '',
  tags: [],
};

export default function AddLead() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [scannedText, setScannedText] = useState('');
  const [saved, setSaved] = useState(false);
  const [scanningCard, setScanningCard] = useState(false);
  const [scanningLinkedIn, setScanningLinkedIn] = useState(false);
  const [captureType, setCaptureType] = useState('partner'); // 'partner' | 'client'
  const [savedRecord, setSavedRecord] = useState(null); // { id, type: 'lead' | 'client' }
  const cameraInputRef = useRef(null);
  const linkedInInputRef = useRef(null);

  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningCard(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const rawResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract contact information from this business card image. Return ONLY the following fields if present:
- name (full name)
- email
- phone
- company (company/organization name)
- title (job title)
- address (full mailing/office address as shown)
Fill in whatever you can find. If a field is not present, leave it as an empty string.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            title: { type: 'string' },
            address: { type: 'string' },
          }
        }
      });
      const result = typeof rawResult === 'object' && rawResult !== null
        ? (rawResult.name || rawResult.email || rawResult.company ? rawResult : rawResult.data ?? rawResult)
        : {};
      setForm(prev => ({
        ...prev,
        name: result.name || prev.name,
        email: result.email || prev.email,
        phone: result.phone || prev.phone,
        company: result.company || prev.company,
        title: result.title || prev.title,
        address: result.address || prev.address,
      }));
      toast.success('Business card scanned! Please review the fields.');
    } catch (err) {
      toast.error('Could not read card: ' + err.message);
    } finally {
      setScanningCard(false);
      e.target.value = '';
    }
  };

  const createLeadMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: (newLead) => {
      setSavedRecord({ id: newLead.id, type: 'lead' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setForm(EMPTY_FORM);
      setScannedText('');
    },
    onError: (error) => {
      toast.error('Failed to add lead: ' + error.message);
    },
  });

  const createClientMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: (newClient) => {
      setSavedRecord({ id: newClient.id, type: 'client' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setForm(EMPTY_FORM);
      setScannedText('');
    },
    onError: (error) => {
      toast.error('Failed to add client: ' + error.message);
    },
  });

  const handleLinkedInCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningLinkedIn(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const rawResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract professional contact information from this LinkedIn profile screenshot. Return ONLY what you can see:
- name (full name)
- title (current job title/position)
- company (current company name)
- industry (industry sector if visible)
- company_size (number of employees if visible, e.g. "51-200")
- address (location shown on the profile, e.g. city/state or full address if visible)
- notes (any other relevant info like bio summary, or mutual connections — do not duplicate the location here)
Leave fields as empty string if not visible.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            title: { type: 'string' },
            company: { type: 'string' },
            industry: { type: 'string' },
            company_size: { type: 'string' },
            address: { type: 'string' },
            notes: { type: 'string' },
          }
        }
      });
      // InvokeLLM with json schema returns the parsed object directly
      const data = typeof rawResult === 'object' && rawResult !== null
        ? (rawResult.name || rawResult.company || rawResult.title ? rawResult : rawResult.data ?? rawResult)
        : {};
      setForm(prev => ({
        ...prev,
        name: data.name || prev.name,
        title: data.title || prev.title,
        company: data.company || prev.company,
        industry: data.industry || prev.industry,
        company_size: data.company_size || prev.company_size,
        address: data.address || prev.address,
        notes: data.notes ? (prev.notes ? prev.notes + '\n' + data.notes : data.notes) : prev.notes,
        outreach_channel: 'linkedin',
        source: prev.source || 'LinkedIn',
      }));
      if (!data.name && !data.title && !data.company) {
        toast.warning('Scan complete but no info found — try a clearer screenshot.');
      } else {
        toast.success('LinkedIn profile scanned! Please review the fields.');
      }
    } catch (err) {
      toast.error('Could not read screenshot: ' + err.message);
    } finally {
      setScanningLinkedIn(false);
      e.target.value = '';
    }
  };

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
    if (captureType === 'client') {
      const clientPayload = {
        name: form.name,
        email: form.email,
        company: form.company || '',
        title: form.title || '',
        phone: form.phone || '',
        company_address: form.address || '',
        industry: form.industry || '',
        company_size: form.company_size || '',
        owner: form.owner || '',
        tags: form.tags || [],
        last_contacted_date: new Date().toISOString().split('T')[0],
        notes: form.source ? (form.notes ? form.notes + `\nMet at: ${form.source}` : `Met at: ${form.source}`) : (form.notes || ''),
      };
      createClientMutation.mutate(clientPayload);
    } else {
      createLeadMutation.mutate({ ...form, tags: form.tags || [] });
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/Leads')} className="p-2">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-[#013f7c] leading-tight">
            {captureType === 'client' ? 'Quick Client Capture' : 'Quick Lead Capture'}
          </h1>
          <p className="text-xs text-gray-500">
            {captureType === 'client' ? 'Saves directly to your Client pipeline' : 'Saves directly to your Partner pipeline'}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-5 pb-10">

        {/* Scan / Paste Section */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanText className="w-5 h-5 text-[#013f7c]" />
              <h2 className="font-semibold text-gray-800">Quick Scan</h2>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => linkedInInputRef.current?.click()}
                disabled={scanningLinkedIn}
                className="bg-[#0077b5] hover:bg-[#005f91] gap-2"
                size="sm"
              >
                {scanningLinkedIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
                {scanningLinkedIn ? 'Scanning...' : 'LinkedIn'}
              </Button>
              <Button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={scanningCard}
                className="bg-[#013f7c] hover:bg-[#012d5a] gap-2"
                size="sm"
              >
                {scanningCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {scanningCard ? 'Scanning...' : 'Scan Card'}
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraCapture}
            />
            <input
              ref={linkedInInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLinkedInCapture}
            />
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
          {/* Capture type toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setCaptureType('partner')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                captureType === 'partner' ? 'bg-[#013f7c] text-white' : 'text-gray-600'
              }`}
            >
              Partner
            </button>
            <button
              type="button"
              onClick={() => setCaptureType('client')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                captureType === 'client' ? 'bg-[#264d44] text-white' : 'text-gray-600'
              }`}
            >
              Client
            </button>
          </div>

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
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City, ST 12345" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="owner">Owner</Label>
            <Select value={form.owner} onValueChange={v => set('owner', v)}>
              <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="William">William</SelectItem>
                <SelectItem value="Heather">Heather</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Tags</Label>
            <TagSelector value={form.tags} onChange={v => set('tags', v)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="source">Where did you meet?</Label>
            <Input id="source" value={form.source} onChange={e => set('source', e.target.value)} placeholder="e.g., SHRM Conference 2026" />
          </div>

          {captureType === 'partner' && (
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
                    {['email', 'linkedin', 'phone', 'referral', 'event', 'other'].map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

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
            className={`w-full text-base py-5 font-semibold transition-all ${saved ? 'bg-green-600 hover:bg-green-700' : (captureType === 'client' ? 'bg-[#264d44] hover:bg-[#1a3a34]' : 'bg-[#013f7c] hover:bg-[#012d5a]')}`}
            disabled={createLeadMutation.isPending || createClientMutation.isPending}
          >
            {createLeadMutation.isPending || createClientMutation.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle2 className="w-5 h-5 mr-2" /> Saved!</>
            ) : (
              <><Save className="w-5 h-5 mr-2" /> {captureType === 'partner' ? 'Save Lead' : 'Save Client'}</>
            )}
          </Button>
        </form>

        {/* Quick nav back */}
        <button
          onClick={() => navigate(captureType === 'client' ? '/Clients' : '/Leads')}
          className="w-full text-center text-sm text-[#013f7c] hover:underline py-2"
        >
          {captureType === 'client' ? 'View all clients →' : 'View all partners →'}
        </button>
      </div>

      {/* Success Dialog */}
      <Dialog open={!!savedRecord} onOpenChange={(open) => !open && setSavedRecord(null)}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>{savedRecord?.type === 'client' ? 'Client saved ✓' : 'Lead saved ✓'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">The record was added to your database.</p>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              className="w-full bg-[#013f7c] hover:bg-[#012d5a]"
              onClick={() => {
                const r = savedRecord;
                setSavedRecord(null);
                navigate(r.type === 'client' ? `/Clients?clientId=${r.id}` : `/Leads?leadId=${r.id}`);
              }}
            >
              {savedRecord?.type === 'client' ? 'Open this client →' : 'Open this lead →'}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setSavedRecord(null)}>
              Capture another
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}