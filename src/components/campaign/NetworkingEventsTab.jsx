import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Users, ExternalLink, Check, X, MapPin, Video, Search, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

// ---------------------------------------------------------------------------
// Networking Events — third tab under Campaigns.
// Phase 1: agenda of approved events, review queue, sources panel, manual add.
// Phase 2+ adds the daily ingestion job that fills these from feeds/inbox.
// ---------------------------------------------------------------------------

const REGIONS = ['MA', 'CT', 'NY', 'NYC', 'RI', 'NH', 'New England', 'National', 'Virtual'];
const FORMATS = [
  { value: 'in_person', label: 'In person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'unknown', label: 'Unknown' },
];
const INTENTS = [
  { value: 'none', label: 'No plans' },
  { value: 'interested', label: 'Interested' },
  { value: 'registered', label: 'Registered' },
  { value: 'attending', label: 'Attending' },
  { value: 'attended', label: 'Attended' },
  { value: 'skip', label: 'Skip' },
];
const OPPORTUNITIES = [
  { value: 'none', label: 'None' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'speak', label: 'Speak' },
  { value: 'exhibit', label: 'Exhibit' },
];
const CHANNELS = [
  { value: 'feed_rss', label: 'RSS feed' },
  { value: 'feed_json', label: 'JSON feed' },
  { value: 'feed_ics', label: 'ICS feed' },
  { value: 'scrape', label: 'Event page' },
  { value: 'email', label: 'Email' },
  { value: 'invite', label: 'Calendar invite' },
  { value: 'manual', label: 'Manual' },
];
const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map(c => [c.value, c.label]));
const CHANNEL_STYLE = {
  feed_rss: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  feed_json: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  feed_ics: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  scrape: 'bg-amber-50 text-amber-700 border-amber-200',
  email: 'bg-violet-50 text-violet-700 border-violet-200',
  invite: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  manual: 'bg-gray-100 text-gray-600 border-gray-200',
};
const INTENT_STYLE = {
  interested: 'bg-blue-50 text-blue-700 border-blue-200',
  registered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  attending: 'bg-green-50 text-green-700 border-green-200',
  attended: 'bg-gray-100 text-gray-600 border-gray-200',
  skip: 'bg-gray-50 text-gray-400 border-gray-200 line-through',
};
const REGION_STYLE = {
  MA: 'bg-[#e3ecf7] text-[#013f7c]',
  CT: 'bg-sky-50 text-sky-700',
  NY: 'bg-purple-50 text-purple-700',
  NYC: 'bg-purple-50 text-purple-700',
  RI: 'bg-teal-50 text-teal-700',
  NH: 'bg-teal-50 text-teal-700',
  'New England': 'bg-[#e3ecf7] text-[#013f7c]',
  National: 'bg-orange-50 text-orange-700',
  Virtual: 'bg-cyan-50 text-cyan-700',
};

// ---- date helpers ----------------------------------------------------------
// All-day events are stored as bare YYYY-MM-DD (calendar days, not instants),
// timed events as ISO instants. Same convention as CalendarEvent / EventDialog.
function parseEventDate(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function toIsoOrDate(form, key) {
  const raw = form[key];
  if (!raw) return undefined;
  if (form.all_day) return raw.slice(0, 10);
  if (/(Z|[+-]\d{2}:\d{2})$/.test(raw)) return raw;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}
function toLocalInput(raw, allDay) {
  const d = parseEventDate(raw);
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (allDay) return date;
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fmtMonthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtMonthLabel = d => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const fmtDay = d => d.toLocaleDateString('en-US', { weekday: 'short' });
const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtTime = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function eventWhen(ev) {
  const s = parseEventDate(ev.start_date);
  const e = parseEventDate(ev.end_date);
  if (!s) return '';
  const sameDay = e && s.toDateString() === e.toDateString();
  if (ev.all_day || /^\d{4}-\d{2}-\d{2}$/.test(ev.start_date)) {
    if (e && !sameDay) return `${fmtDate(s)} – ${fmtDate(e)}`;
    return fmtDate(s);
  }
  if (e && sameDay) return `${fmtDate(s)} · ${fmtTime(s)} – ${fmtTime(e)}`;
  if (e && !sameDay) return `${fmtDate(s)} ${fmtTime(s)} – ${fmtDate(e)} ${fmtTime(e)}`;
  return `${fmtDate(s)} · ${fmtTime(s)}`;
}
function eventWhere(ev) {
  if (ev.format === 'virtual') return ev.venue || 'Virtual';
  const parts = [ev.venue, [ev.city, ev.state].filter(Boolean).join(', ')].filter(Boolean);
  return parts.join(' · ') || (ev.region || '');
}

// ---- event form ------------------------------------------------------------
const EMPTY_EVENT = {
  title: '', org_code: '', description: '', start_date: '', end_date: '', all_day: false,
  format: 'in_person', venue: '', city: '', state: '', region: '', registration_url: '',
  cost_text: '', intent: 'none', owner: '', opportunity: 'none', notes: '', status: 'approved',
};

function EventForm({ initial, sources, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_EVENT,
    ...initial,
    start_date: toLocalInput(initial?.start_date, initial?.all_day),
    end_date: toLocalInput(initial?.end_date, initial?.all_day),
  }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAllDay = (v) => {
    setForm(f => ({
      ...f, all_day: v,
      start_date: f.start_date ? (v ? f.start_date.slice(0, 10) : `${f.start_date.slice(0, 10)}T09:00`) : '',
      end_date: f.end_date ? (v ? f.end_date.slice(0, 10) : `${f.end_date.slice(0, 10)}T10:00`) : '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.org_code || !form.start_date) {
      toast.error('Title, organization and start date are required.');
      return;
    }
    const src = sources.find(s => s.org_code === form.org_code);
    const payload = {
      ...form,
      org_name: src?.org_name || form.org_name || form.org_code,
      source_id: src?.id || form.source_id,
      region: form.region || (form.format === 'virtual' ? 'Virtual' : src?.region) || undefined,
      start_date: toIsoOrDate(form, 'start_date'),
      end_date: toIsoOrDate(form, 'end_date'),
      channel: form.channel || 'manual',
      confidence: form.confidence || 'high',
    };
    if (!payload.end_date) delete payload.end_date;
    onSave(payload);
  };

  const label = 'text-sm font-medium text-gray-700 block mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={label}>Title *</label>
        <Input placeholder="e.g., Breakfast with Benefits: Retirement Design" value={form.title} onChange={e => set('title', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Organization *</label>
          <Select value={form.org_code} onValueChange={v => set('org_code', v)}>
            <SelectTrigger><SelectValue placeholder="Select org" /></SelectTrigger>
            <SelectContent>{sources.map(s => <SelectItem key={s.org_code} value={s.org_code}>{s.org_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className={label}>Format</label>
          <Select value={form.format} onValueChange={v => set('format', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={!!form.all_day} onCheckedChange={handleAllDay} />
        <span className="text-sm text-gray-600">All day / multi-day (no set time)</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Start *</label>
          <Input type={form.all_day ? 'date' : 'datetime-local'} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className={label}>End</label>
          <Input type={form.all_day ? 'date' : 'datetime-local'} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-3 sm:col-span-1">
          <label className={label}>Venue</label>
          <Input value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="Zoom / venue name" />
        </div>
        <div>
          <label className={label}>City</label>
          <Input value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <label className={label}>State</label>
          <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="MA" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Region</label>
          <Select value={form.region || ''} onValueChange={v => set('region', v)}>
            <SelectTrigger><SelectValue placeholder="Auto from org" /></SelectTrigger>
            <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className={label}>Cost</label>
          <Input value={form.cost_text} onChange={e => set('cost_text', e.target.value)} placeholder="$225 member / $325 non-member" />
        </div>
      </div>
      <div>
        <label className={label}>Registration / details link</label>
        <Input value={form.registration_url} onChange={e => set('registration_url', e.target.value)} placeholder="https://" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={label}>Our plan</label>
          <Select value={form.intent} onValueChange={v => set('intent', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INTENTS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className={label}>Owner</label>
          <Select value={form.owner || 'unassigned'} onValueChange={v => set('owner', v === 'unassigned' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="William">William</SelectItem>
              <SelectItem value="Heather">Heather</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className={label}>Opportunity</label>
          <Select value={form.opportunity} onValueChange={v => set('opportunity', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{OPPORTUNITIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className={label}>Notes</label>
        <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Who else is going, why it matters…" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={saving} className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white">{saving ? 'Saving…' : 'Save event'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ---- source form -----------------------------------------------------------
const EMPTY_SOURCE = { org_name: '', org_code: '', full_name: '', region: 'MA', tier: 1, channel: 'manual', website: '', page_url: '', feed_url: '', sender_patterns: [], auto_approve: false, is_active: true, notes: '' };

function SourceForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_SOURCE, ...initial });
  const [senders, setSenders] = useState((initial?.sender_patterns || []).join(', '));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const label = 'text-sm font-medium text-gray-700 block mb-1';
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.org_name || !form.org_code || !form.channel) { toast.error('Name, code and channel are required.'); return; }
    onSave({ ...form, tier: Number(form.tier) || 1, sender_patterns: senders.split(',').map(s => s.trim()).filter(Boolean) });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>Short name *</label><Input value={form.org_name} onChange={e => set('org_name', e.target.value)} placeholder="NEEBC" /></div>
        <div><label className={label}>Code *</label><Input value={form.org_code} onChange={e => set('org_code', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="neebc" disabled={!!initial?.id} /></div>
      </div>
      <div><label className={label}>Full name</label><Input value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={label}>Region</label>
          <Select value={form.region} onValueChange={v => set('region', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className={label}>Tier</label>
          <Select value={String(form.tier)} onValueChange={v => set('tier', Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">1 — core</SelectItem><SelectItem value="2">2 — secondary</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <label className={label}>Channel</label>
          <Select value={form.channel} onValueChange={v => set('channel', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><label className={label}>Website</label><Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" /></div>
      <div><label className={label}>Events page URL</label><Input value={form.page_url} onChange={e => set('page_url', e.target.value)} placeholder="https://" /></div>
      <div><label className={label}>Feed URL (RSS / JSON / ICS)</label><Input value={form.feed_url} onChange={e => set('feed_url', e.target.value)} placeholder="https://" /></div>
      <div><label className={label}>Email senders to watch (comma-separated)</label><Input value={senders} onChange={e => setSenders(e.target.value)} placeholder="info@org.com, @org.com" /></div>
      <div><label className={label}>Notes</label><Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-600"><Switch checked={!!form.is_active} onCheckedChange={v => set('is_active', v)} /> Active</label>
        <label className="flex items-center gap-2 text-sm text-gray-600"><Switch checked={!!form.auto_approve} onCheckedChange={v => set('auto_approve', v)} /> Auto-approve</label>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={saving} className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white">{saving ? 'Saving…' : 'Save source'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ---- event row -------------------------------------------------------------
function EventRow({ ev, onEdit, onIntent, onApprove, onReject, onDelete, review }) {
  const s = parseEventDate(ev.start_date);
  const intentStyle = INTENT_STYLE[ev.intent];
  return (
    <div className={`flex gap-3 sm:gap-4 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors ${ev.intent === 'skip' ? 'opacity-50' : ''}`}>
      <div className="w-12 shrink-0 text-center">
        <div className="text-[10px] uppercase tracking-wide text-gray-400">{s ? fmtDay(s) : ''}</div>
        <div className="text-lg font-semibold text-gray-800 leading-tight">{s ? s.getDate() : '—'}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${REGION_STYLE[ev.region] || 'bg-gray-100 text-gray-600'}`}>{ev.org_name || ev.org_code}</span>
          {ev.opportunity && ev.opportunity !== 'none' && <Badge className="border text-[10px] bg-amber-50 text-amber-700 border-amber-200">{ev.opportunity}</Badge>}
          {intentStyle && <Badge className={`border text-[10px] ${intentStyle}`}>{INTENTS.find(i => i.value === ev.intent)?.label}{ev.owner ? ` · ${ev.owner}` : ''}</Badge>}
          {review && <Badge className={`border text-[10px] ${CHANNEL_STYLE[ev.channel] || ''}`}>{CHANNEL_LABEL[ev.channel] || ev.channel}{ev.confidence && ev.confidence !== 'high' ? ` · ${ev.confidence}` : ''}</Badge>}
        </div>
        <p className="font-medium text-gray-900 text-sm leading-snug mt-0.5">
          {ev.registration_url ? <a href={ev.registration_url} target="_blank" rel="noreferrer" className="hover:text-[#013f7c] hover:underline">{ev.title}</a> : ev.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
          <span>{eventWhen(ev)}</span>
          <span className="inline-flex items-center gap-1">{ev.format === 'virtual' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}{eventWhere(ev)}</span>
          {ev.cost_text && <span>· {ev.cost_text}</span>}
        </p>
        {ev.notes && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{ev.notes}</p>}
      </div>
      <div className="flex items-start gap-1 shrink-0">
        {review ? (
          <>
            <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50" onClick={() => onApprove(ev)}><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 hover:text-red-600" onClick={() => onReject(ev)}><X className="w-3.5 h-3.5 mr-1" />Reject</Button>
          </>
        ) : (
          <Select value={ev.intent || 'none'} onValueChange={v => onIntent(ev, v)}>
            <SelectTrigger className="h-7 w-[118px] text-xs hidden sm:flex"><SelectValue /></SelectTrigger>
            <SelectContent>{INTENTS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {ev.registration_url && <a href={ev.registration_url} target="_blank" rel="noreferrer" className="w-7 h-7 inline-flex items-center justify-center text-gray-400 hover:text-[#013f7c]" title="Open registration"><ExternalLink className="w-3.5 h-3.5" /></a>}
        <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-400 hover:text-[#013f7c]" onClick={() => onEdit(ev)}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-400 hover:text-red-500" onClick={() => onDelete(ev)}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

// ---- main tab --------------------------------------------------------------
export default function NetworkingEventsTab() {
  const { isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState('upcoming'); // upcoming | review | past | sources
  const [eventDialog, setEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [sourceDialog, setSourceDialog] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [filters, setFilters] = useState({ org: 'all', region: 'all', format: 'all', intent: 'all', q: '' });
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const { data: sources = [], isLoading: loadingSources } = useQuery({
    queryKey: ['event_sources'],
    queryFn: () => base44.entities.EventSource.list('org_name', 200),
    enabled: !isLoadingAuth,
  });
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['networking_events'],
    queryFn: () => base44.entities.NetworkingEvent.list('start_date', 1000),
    enabled: !isLoadingAuth,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['networking_events'] });
    queryClient.invalidateQueries({ queryKey: ['event_sources'] });
  };
  const createEvent = useMutation({ mutationFn: d => base44.entities.NetworkingEvent.create(d), onSuccess: () => { invalidate(); toast.success('Event added'); setEventDialog(false); setEditingEvent(null); }, onError: () => toast.error('Could not save event') });
  const updateEvent = useMutation({ mutationFn: ({ id, data }) => base44.entities.NetworkingEvent.update(id, data), onSuccess: () => { invalidate(); setEventDialog(false); setEditingEvent(null); }, onError: () => toast.error('Could not update event') });
  const deleteEvent = useMutation({ mutationFn: id => base44.entities.NetworkingEvent.delete(id), onSuccess: () => { invalidate(); toast.success('Event removed'); }, onError: () => toast.error('Could not delete event') });
  const createSource = useMutation({ mutationFn: d => base44.entities.EventSource.create(d), onSuccess: () => { invalidate(); toast.success('Source added'); setSourceDialog(false); setEditingSource(null); }, onError: () => toast.error('Could not save source') });
  const updateSource = useMutation({ mutationFn: ({ id, data }) => base44.entities.EventSource.update(id, data), onSuccess: () => { invalidate(); setSourceDialog(false); setEditingSource(null); }, onError: () => toast.error('Could not update source') });

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const in30 = useMemo(() => new Date(today.getTime() + 30 * 86400000), [today]);

  const enriched = useMemo(() => events.map(ev => ({ ...ev, _start: parseEventDate(ev.start_date), _end: parseEventDate(ev.end_date) || parseEventDate(ev.start_date) })), [events]);
  const pending = enriched.filter(e => e.status === 'pending_review');
  const approved = enriched.filter(e => e.status === 'approved');
  const upcoming = approved.filter(e => e._end && e._end >= today).sort((a, b) => a._start - b._start);
  const past = approved.filter(e => e._end && e._end < today).sort((a, b) => b._start - a._start);

  const applyFilters = list => list.filter(e => {
    if (filters.org !== 'all' && e.org_code !== filters.org) return false;
    if (filters.region !== 'all' && e.region !== filters.region) return false;
    if (filters.format !== 'all' && e.format !== filters.format) return false;
    if (filters.intent !== 'all') {
      if (filters.intent === 'planned' && !['interested', 'registered', 'attending'].includes(e.intent)) return false;
      if (filters.intent !== 'planned' && e.intent !== filters.intent) return false;
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (!`${e.title} ${e.org_name} ${e.venue} ${e.city} ${e.notes}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const list = view === 'review' ? pending : view === 'past' ? applyFilters(past) : applyFilters(upcoming);
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of list) {
      if (!e._start) continue;
      const k = fmtMonthKey(e._start);
      if (!map.has(k)) map.set(k, { label: fmtMonthLabel(e._start), items: [] });
      map.get(k).items.push(e);
    }
    return [...map.values()];
  }, [list]);

  const next30 = upcoming.filter(e => e._start <= in30).length;
  const planned = upcoming.filter(e => ['registered', 'attending'].includes(e.intent)).length;
  const activeSources = sources.filter(s => s.is_active).length;

  if (isLoadingAuth) {
    return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" /></div>;
  }

  const saveEvent = (payload) => {
    if (editingEvent?.id) updateEvent.mutate({ id: editingEvent.id, data: payload });
    else createEvent.mutate(payload);
  };
  const openEditEvent = ev => { setEditingEvent(ev); setEventDialog(true); };
  const openNewEvent = () => { setEditingEvent(null); setEventDialog(true); };
  const setIntent = (ev, intent) => updateEvent.mutate({ id: ev.id, data: { intent } });
  const approve = ev => updateEvent.mutate({ id: ev.id, data: { status: 'approved' } });
  const reject = ev => updateEvent.mutate({ id: ev.id, data: { status: 'rejected' } });
  const remove = ev => { if (confirm(`Delete "${ev.title}"?`)) deleteEvent.mutate(ev.id); };

  const saveSource = (payload) => {
    if (editingSource?.id) updateSource.mutate({ id: editingSource.id, data: payload });
    else createSource.mutate(payload);
  };

  const viewBtn = (key, label, count) => (
    <button
      type="button"
      onClick={() => setView(key)}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === key ? 'bg-[#013f7c] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {label}{typeof count === 'number' && count > 0 && <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${view === key ? 'bg-white/20' : key === 'review' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>{count}</span>}
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#013f7c] flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-white" /></div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Networking Events</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Broker, HR and wellness-community events across New England and New York</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {view === 'sources' ? (
            <Button onClick={() => { setEditingSource(null); setSourceDialog(true); }} className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white gap-1.5 text-sm"><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add</span> Source</Button>
          ) : (
            <Button onClick={openNewEvent} className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white gap-1.5 text-sm"><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add</span> Event</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          ['Next 30 days', next30],
          ['Registered / attending', planned],
          ['Needs review', pending.length],
          ['Sources watched', activeSources],
        ].map(([label, n]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-sm">
            <p className="text-xs text-gray-500 mb-0.5 leading-tight">{label}</p>
            <p className="text-xl font-bold text-gray-800 tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-3">
        {viewBtn('upcoming', 'Upcoming', upcoming.length)}
        {viewBtn('review', 'Needs review', pending.length)}
        {viewBtn('past', 'Past')}
        {viewBtn('sources', 'Sources', sources.length)}
      </div>

      {view !== 'sources' && view !== 'review' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input className="h-8 pl-8 text-sm" placeholder="Search events" value={filters.q} onChange={e => setFilter('q', e.target.value)} />
          </div>
          <Select value={filters.org} onValueChange={v => setFilter('org', v)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All orgs</SelectItem>{sources.map(s => <SelectItem key={s.org_code} value={s.org_code}>{s.org_name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.region} onValueChange={v => setFilter('region', v)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All regions</SelectItem>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.format} onValueChange={v => setFilter('format', v)}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Any format</SelectItem>{FORMATS.filter(f => f.value !== 'unknown').map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.intent} onValueChange={v => setFilter('intent', v)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any plan</SelectItem>
              <SelectItem value="planned">Planned (any)</SelectItem>
              {INTENTS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {view === 'sources' ? (
        loadingSources ? <div className="p-8 text-center text-gray-400 text-sm">Loading sources…</div> : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Organization</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Region</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Tier</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Channel</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Last checked</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Auto-approve</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Active</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {sources.map(s => {
                  const count = upcoming.filter(e => e.org_code === s.org_code).length;
                  return (
                    <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${!s.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{s.org_name} <span className="text-xs text-gray-400 font-normal">· {count} upcoming</span></div>
                        <div className="text-xs text-gray-500 truncate max-w-[280px]">{s.full_name || s.website}</div>
                      </td>
                      <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${REGION_STYLE[s.region] || 'bg-gray-100 text-gray-600'}`}>{s.region}</span></td>
                      <td className="px-4 py-3 text-center text-gray-600 tabular-nums">{s.tier}</td>
                      <td className="px-4 py-3">
                        <Badge className={`border text-[10px] ${CHANNEL_STYLE[s.channel] || ''}`}>{CHANNEL_LABEL[s.channel] || s.channel}</Badge>
                        {s.in_inbox && <span className="ml-1 text-[10px] text-violet-600" title="Already emails william@">✉</span>}
                        {s.last_error && <span className="ml-1 text-[10px] text-red-600" title={s.last_error}>error</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.last_polled_at ? new Date(s.last_polled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : <span className="text-gray-300">not yet</span>}</td>
                      <td className="px-4 py-3 text-center"><Switch checked={!!s.auto_approve} onCheckedChange={v => updateSource.mutate({ id: s.id, data: { auto_approve: v } })} /></td>
                      <td className="px-4 py-3 text-center"><Switch checked={!!s.is_active} onCheckedChange={v => updateSource.mutate({ id: s.id, data: { is_active: v } })} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(s.page_url || s.website) && <a href={s.page_url || s.website} target="_blank" rel="noreferrer" className="w-7 h-7 inline-flex items-center justify-center text-gray-400 hover:text-[#013f7c]"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-400 hover:text-[#013f7c]" onClick={() => { setEditingSource(s); setSourceDialog(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-50 flex items-center gap-1.5"><Radio className="w-3 h-3" /> The daily check that fills this calendar from feeds and your inbox arrives in the next phase; until then, events are added by hand.</div>
          </div>
        )
      ) : loadingEvents ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading events…</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{view === 'review' ? 'Nothing waiting for review.' : view === 'past' ? 'No past events yet.' : 'No upcoming events match these filters.'}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g.label}>
              <div className="flex items-baseline justify-between px-1 mb-1.5">
                <h2 className="text-sm font-semibold text-gray-700">{g.label}</h2>
                <span className="text-xs text-gray-400">{g.items.length} event{g.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {g.items.map(ev => (
                  <EventRow key={ev.id} ev={ev} review={view === 'review'} onEdit={openEditEvent} onIntent={setIntent} onApprove={approve} onReject={reject} onDelete={remove} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={eventDialog} onOpenChange={v => { setEventDialog(v); if (!v) setEditingEvent(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEvent ? 'Edit event' : 'Add event'}</DialogTitle></DialogHeader>
          <EventForm key={editingEvent?.id || 'new'} initial={editingEvent || EMPTY_EVENT} sources={sources} onSave={saveEvent} onCancel={() => { setEventDialog(false); setEditingEvent(null); }} saving={createEvent.isPending || updateEvent.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={sourceDialog} onOpenChange={v => { setSourceDialog(v); if (!v) setEditingSource(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingSource ? 'Edit source' : 'Add source'}</DialogTitle></DialogHeader>
          <SourceForm key={editingSource?.id || 'new'} initial={editingSource || EMPTY_SOURCE} onSave={saveSource} onCancel={() => { setSourceDialog(false); setEditingSource(null); }} saving={createSource.isPending || updateSource.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
