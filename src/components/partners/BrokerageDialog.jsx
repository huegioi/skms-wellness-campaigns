import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { Building2, Layers, Percent, Users, Plus, Trash2 } from 'lucide-react';
import { RecordDetailContent, RecordDetailFrame, RailSection, FrameSection } from '@/components/shared/RecordDetailFrame';
import { useToast } from '@/components/ui/use-toast';
import { isExcludedDomain } from '@/lib/emailDomain';

const DEFAULT_TIERS = [
  { label: 'Introducing Partner', min_revenue: 0, max_revenue: 74999, rate: 0.10 },
  { label: 'Active Partner', min_revenue: 75000, max_revenue: 149999, rate: 0.125 },
  { label: 'Strategic Partner', min_revenue: 150000, max_revenue: null, rate: 0.15 },
];

const EMPTY_FORM = {
  name: '',
  company: '',
  email_domain: '',
  email_domain_aliases: '',
  notes: '',
  commission_tiers: DEFAULT_TIERS,
  brokerage_commission_enabled: true,
  broker_commission_enabled: true,
  broker_split: 0.5,
};

// Normalize a domain string: lowercase, trim, strip leading @ or https://
function normalizeDomain(raw) {
  let d = (raw || '').toLowerCase().trim();
  if (d.startsWith('@')) d = d.slice(1);
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/\/$/, '');
  return d;
}

// Parse comma-separated aliases into a normalized array
function parseAliases(raw) {
  return (raw || '')
    .split(',')
    .map(s => normalizeDomain(s))
    .filter(d => d.length > 0);
}

export default function BrokerageDialog({ open, onOpenChange, editing, onSaved, defaultEmailDomain }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [domainErrors, setDomainErrors] = useState([]);

  const { data: existingBrokerages = [] } = useQuery({
    queryKey: ['brokerages'],
    queryFn: () => base44.entities.Brokerage.list('name', 500),
  });

  useEffect(() => {
    if (open) {
      setDomainErrors([]);
      if (editing) {
        setForm({
          name: editing.name || '',
          company: editing.company || '',
          email_domain: editing.email_domain || '',
          email_domain_aliases: (editing.email_domain_aliases || []).join(', '),
          notes: editing.notes || '',
          commission_tiers: editing.commission_tiers || DEFAULT_TIERS,
          brokerage_commission_enabled: editing.brokerage_commission_enabled !== false,
          broker_commission_enabled: editing.broker_commission_enabled !== false,
          broker_split: editing.broker_split ?? 0.5,
        });
      } else {
        setForm({ ...EMPTY_FORM, email_domain: defaultEmailDomain || '' });
      }
    }
  }, [editing, open, defaultEmailDomain]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        return base44.entities.Brokerage.update(editing.id, data);
      }
      return base44.entities.Brokerage.create(data);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['brokerages'] });
      qc.invalidateQueries({ queryKey: ['referralPartners'] });
      onOpenChange(false);
      toast({ title: editing ? 'Brokerage updated' : 'Brokerage created' });
      onSaved?.(saved);
    },
  });

  const validateDomains = () => {
    const errors = [];
    const normalizedDomain = normalizeDomain(form.email_domain);
    const normalizedAliases = parseAliases(form.email_domain_aliases);

    // Reject free-mail in primary
    if (normalizedDomain && isExcludedDomain(normalizedDomain)) {
      errors.push(`${normalizedDomain} is a personal email provider, not a firm domain.`);
    }

    // Reject free-mail in aliases
    for (const alias of normalizedAliases) {
      if (isExcludedDomain(alias)) {
        errors.push(`${alias} is a personal email provider, not a firm domain.`);
      }
    }

    // Reject domains already claimed by another brokerage
    const allDomains = [...(normalizedDomain ? [normalizedDomain] : []), ...normalizedAliases];
    for (const d of allDomains) {
      const claimer = existingBrokerages.find(b => {
        if (editing && b.id === editing.id) return false;
        const primary = (b.email_domain || '').toLowerCase().trim();
        const aliases = (b.email_domain_aliases || []).map(a => String(a).toLowerCase().trim());
        return primary === d || aliases.includes(d);
      });
      if (claimer) {
        errors.push(`Domain ${d} is already claimed by ${claimer.name}.`);
      }
    }

    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validateDomains();
    if (errors.length > 0) {
      setDomainErrors(errors);
      return;
    }
    setDomainErrors([]);
    saveMutation.mutate({
      ...form,
      email_domain: normalizeDomain(form.email_domain),
      email_domain_aliases: parseAliases(form.email_domain_aliases),
    });
  };

  const updateTier = (i, field, value) => {
    const tiers = [...form.commission_tiers];
    tiers[i] = {
      ...tiers[i],
      [field]: field === 'rate'
        ? parseFloat(value) || 0
        : field.includes('revenue')
          ? (value === '' ? null : parseFloat(value))
          : value,
    };
    setForm(f => ({ ...f, commission_tiers: tiers }));
  };

  // New tier starts where the current top tier ends, open-ended.
  const addTier = () => {
    setForm(f => {
      const tiers = [...(f.commission_tiers || [])];
      const last = tiers[tiers.length - 1];
      const min = last ? (last.max_revenue != null ? last.max_revenue + 1 : (last.min_revenue || 0)) : 0;
      return { ...f, commission_tiers: [...tiers, { label: '', min_revenue: min, max_revenue: null, rate: 0 }] };
    });
  };

  const removeTier = (i) => {
    setForm(f => ({ ...f, commission_tiers: (f.commission_tiers || []).filter((_, idx) => idx !== i) }));
  };

  // Brokers at this firm — same query key as BrokerageRollup, so the cache is shared.
  const { data: firmBrokers = [] } = useQuery({
    queryKey: ['brokerage-partners', editing?.id],
    queryFn: () => base44.entities.ReferralPartner.filter({ brokerage_id: editing.id, is_demo: false }, '-created_date', 500),
    enabled: open && !!editing?.id,
  });

  const bothEnabled = form.brokerage_commission_enabled && form.broker_commission_enabled;
  const brokeragePct = Math.round((1 - form.broker_split) * 100);
  const brokerPct = Math.round(form.broker_split * 100);

  const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
  const pct = (r) => {
    const v = (Number(r) || 0) * 100;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}%`;
  };
  // Where the firm sits today, against the tiers as currently edited.
  const firmYtd = firmBrokers.reduce((sum, p) => sum + (p.ytd_revenue || 0), 0);
  const tiersSorted = [...(form.commission_tiers || [])].sort((a, b) => (a.min_revenue || 0) - (b.min_revenue || 0));
  const currentTier = tiersSorted.filter(t => firmYtd >= (t.min_revenue || 0)).pop() || null;
  const nextTier = tiersSorted.find(t => (t.min_revenue || 0) > firmYtd) || null;

  // ── Responsive layout (see RecordDetailFrame) ──
  // Main: the firm and its tier table. Rail: commission structure (and, when
  // editing, the firm's brokers + current tier). Footer: Save stays pinned.
  const header = (
    <div className="min-w-0">
      <DialogTitle className="text-xl font-bold text-[#013f7c]">{editing ? 'Edit Brokerage' : 'Add Brokerage'}</DialogTitle>
      <p className="text-sm text-gray-500 mt-0.5 truncate">
        {editing
          ? [editing.name, normalizeDomain(editing.email_domain)].filter(Boolean).join(' · ')
          : 'Group brokers under one firm with a shared, two-level commission structure.'}
      </p>
    </div>
  );

  const splitInput = (label, dotClass, value, onValue) => (
    <div>
      <label className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} /> {label}
      </label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0" max="100"
          value={value}
          onChange={e => onValue(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
          className="text-sm h-9 bg-white"
        />
        <span className="text-gray-500 text-sm">%</span>
      </div>
    </div>
  );

  const rail = (
    <>
      <RailSection title="Commission structure" icon={Percent}>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Brokerage commission</label>
              <p className="text-xs text-gray-400">The brokerage (house) earns commission on placements</p>
            </div>
            <Switch
              checked={form.brokerage_commission_enabled}
              onCheckedChange={(checked) => setForm(f => ({ ...f, brokerage_commission_enabled: checked }))}
            />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Broker commission</label>
              <p className="text-xs text-gray-400">Individual brokers earn commission. When off, broker portals hide commission features.</p>
            </div>
            <Switch
              checked={form.broker_commission_enabled}
              onCheckedChange={(checked) => setForm(f => ({ ...f, broker_commission_enabled: checked }))}
            />
          </div>

          {/* Split control — only when both are on */}
          {bothEnabled && (
            <div className="pt-3 border-t border-gray-200">
              <label className="text-sm font-medium text-gray-700 block mb-2">Commission split</label>
              <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-gray-100 mb-2.5" aria-hidden="true">
                <div className="bg-[#013f7c] transition-all" style={{ width: `${brokeragePct}%` }} />
                <div className="bg-[#770142] transition-all" style={{ width: `${brokerPct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {splitInput('Brokerage share', 'bg-[#013f7c]', brokeragePct, (val) => setForm(f => ({ ...f, broker_split: (100 - val) / 100 })))}
                {splitInput('Broker share', 'bg-[#770142]', brokerPct, (val) => setForm(f => ({ ...f, broker_split: val / 100 })))}
              </div>
            </div>
          )}

          {!bothEnabled && (form.brokerage_commission_enabled || form.broker_commission_enabled) && (
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
              {form.brokerage_commission_enabled
                ? 'Brokerage receives 100% of commission.'
                : 'Brokers receive 100% of commission.'}
            </p>
          )}

          {!form.brokerage_commission_enabled && !form.broker_commission_enabled && (
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
              No commission accrues for this brokerage's referrals. Statuses still track.
            </p>
          )}
        </div>
      </RailSection>

      {editing && (
        <RailSection title={`Brokers at this firm (${firmBrokers.length})`} icon={Users}>
          {firmBrokers.length === 0 ? (
            <p className="text-xs text-gray-400">No referral partners are linked to this brokerage yet. Link one from the Brokerage field on a partner's record.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="rounded-md bg-gray-50 px-2.5 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Firm YTD</p>
                  <p className="text-base font-bold text-[#264d44] tabular-nums">{money(firmYtd)}</p>
                </div>
                <div className="rounded-md bg-gray-50 px-2.5 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Current tier</p>
                  <p className="text-sm font-semibold text-[#013f7c] truncate">
                    {currentTier ? `${currentTier.label || 'Tier'} · ${pct(currentTier.rate)}` : '—'}
                  </p>
                </div>
              </div>
              {nextTier && (
                <p className="text-[11px] text-gray-500 mb-2">
                  {money((nextTier.min_revenue || 0) - firmYtd)} more first-year revenue reaches {nextTier.label || 'the next tier'} ({pct(nextTier.rate)}).
                </p>
              )}
              <ul className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                {[...firmBrokers].sort((a, b) => (b.ytd_revenue || 0) - (a.ytd_revenue || 0)).map(p => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="truncate text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-500 tabular-nums shrink-0">{money(p.ytd_revenue)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </RailSection>
      )}
    </>
  );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
      {/* form= submits the form in the body even though the button sits outside it */}
      <Button type="submit" form="brokerage-form" disabled={saveMutation.isPending} className="bg-[#013f7c] hover:bg-[#012d5a] text-white">
        {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Brokerage'}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RecordDetailContent maxWidth="1040px" fill={false}>
        <RecordDetailFrame header={header} rail={rail} footer={footer}>
          <form id="brokerage-form" onSubmit={handleSubmit} className="space-y-6">
            <FrameSection title="Firm" icon={Building2}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Company</label>
                  <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Legal entity name" />
                </div>
              </div>

              {/* Email domain + aliases */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Email domain</label>
                  <Input value={form.email_domain} onChange={e => setForm(f => ({ ...f, email_domain: e.target.value }))} placeholder="e.g. burnsemployeebenefits.com" />
                  <p className="text-xs text-gray-400 mt-1">The firm's mail domain — this is how brokers are matched to this firm.</p>
                  {!normalizeDomain(form.email_domain) && (
                    <p className="text-xs text-amber-600 mt-1">No domain set — this firm won't be matched to any broker automatically.</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Domain aliases</label>
                  <Input value={form.email_domain_aliases} onChange={e => setForm(f => ({ ...f, email_domain_aliases: e.target.value }))} placeholder="e.g. oldfirm.com, legacy-brand.com" />
                  <p className="text-xs text-gray-400 mt-1">Other domains this firm owns, e.g. after an acquisition.</p>
                </div>
              </div>

              {domainErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                  {domainErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700 font-medium">{err}</p>
                  ))}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </FrameSection>

            {/* Commission Tiers */}
            <FrameSection
              title="Commission tiers"
              icon={Layers}
              action={
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={addTier}>
                  <Plus className="w-4 h-4 mr-1" /> Add tier
                </Button>
              }
            >
              <p className="text-xs text-gray-400">Tiers are computed on the brokerage's aggregate first-year revenue across all its brokers this calendar year.</p>
              {form.commission_tiers.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
                  <p className="text-sm text-gray-600">No tiers set. Referrals from this firm's brokers calculate at 0% commission until one is added.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setForm(f => ({ ...f, commission_tiers: DEFAULT_TIERS.map(t => ({ ...t })) }))}
                  >
                    Use the standard three tiers
                  </Button>
                </div>
              )}
              <div className={`${form.commission_tiers.length === 0 ? 'hidden' : 'hidden sm:grid'} grid-cols-12 gap-2 px-3 text-[10px] uppercase tracking-wide text-gray-400`}>
                <span className="col-span-3">Label</span>
                <span className="col-span-3">Min revenue</span>
                <span className="col-span-3">Max revenue</span>
                <span className="col-span-3">Rate</span>
              </div>
              <div className="space-y-2">
                {form.commission_tiers.map((tier, i) => {
                  const isCurrent = !!editing && firmBrokers.length > 0 && tier === currentTier;
                  return (
                    <div
                      key={i}
                      title={isCurrent ? 'The firm is in this tier today' : undefined}
                      className={`grid grid-cols-2 sm:grid-cols-12 gap-2 items-center p-3 rounded-lg ${isCurrent ? 'bg-[#013f7c]/5 ring-1 ring-[#013f7c]/30' : 'bg-gray-50'}`}
                    >
                      <div className="col-span-2 sm:col-span-3">
                        <Input value={tier.label} onChange={e => updateTier(i, 'label', e.target.value)} placeholder="Label" className="text-sm bg-white" />
                      </div>
                      <div className="sm:col-span-3">
                        <Input type="number" value={tier.min_revenue} onChange={e => updateTier(i, 'min_revenue', e.target.value)} placeholder="Min $" className="text-sm bg-white" />
                      </div>
                      <div className="sm:col-span-3">
                        <Input type="number" value={tier.max_revenue ?? ''} onChange={e => updateTier(i, 'max_revenue', e.target.value)} placeholder="Max $ (blank=∞)" className="text-sm bg-white" />
                      </div>
                      <div className="col-span-2 sm:col-span-3 flex items-center gap-1.5">
                        <Input type="number" step="0.001" min="0" max="1" value={tier.rate} onChange={e => updateTier(i, 'rate', e.target.value)} placeholder="Rate (0.125)" className="text-sm bg-white min-w-0" />
                        <span className="text-gray-500 text-sm w-11 text-right shrink-0 tabular-nums">{pct(tier.rate)}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeTier(i)}
                          title="Remove this tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FrameSection>
          </form>
        </RecordDetailFrame>
      </RecordDetailContent>
    </Dialog>
  );
}
