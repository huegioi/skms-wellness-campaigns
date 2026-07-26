import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  const bothEnabled = form.brokerage_commission_enabled && form.broker_commission_enabled;
  const brokeragePct = Math.round((1 - form.broker_split) * 100);
  const brokerPct = Math.round(form.broker_split * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Brokerage' : 'Add Brokerage'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
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
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

          {/* Commission Tiers */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Commission Tiers</label>
            <p className="text-xs text-gray-400 mb-2">Tiers are computed on the brokerage's aggregate first-year revenue across all its brokers this calendar year.</p>
            <div className="space-y-2">
              {form.commission_tiers.map((tier, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-center p-3 bg-gray-50 rounded-lg">
                  <Input value={tier.label} onChange={e => updateTier(i, 'label', e.target.value)} placeholder="Label" className="text-sm" />
                  <Input type="number" value={tier.min_revenue} onChange={e => updateTier(i, 'min_revenue', e.target.value)} placeholder="Min $" className="text-sm" />
                  <Input type="number" value={tier.max_revenue ?? ''} onChange={e => updateTier(i, 'max_revenue', e.target.value)} placeholder="Max $ (blank=∞)" className="text-sm" />
                  <div className="flex items-center gap-1">
                    <Input type="number" step="0.001" min="0" max="1" value={tier.rate} onChange={e => updateTier(i, 'rate', e.target.value)} placeholder="Rate (0.125)" className="text-sm" />
                    <span className="text-gray-500 text-sm">{(tier.rate * 100 % 1 === 0 ? (tier.rate * 100).toFixed(0) : (tier.rate * 100).toFixed(1))}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commission Toggle Switches */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Brokerage commission</label>
                <p className="text-xs text-gray-400">The brokerage (house) earns commission on placements</p>
              </div>
              <Switch
                checked={form.brokerage_commission_enabled}
                onCheckedChange={(checked) => setForm(f => ({ ...f, brokerage_commission_enabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
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
                <label className="text-sm font-medium text-gray-700 block mb-2">Commission Split</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Brokerage share</label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0" max="100"
                        value={brokeragePct}
                        onChange={e => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                          setForm(f => ({ ...f, broker_split: (100 - val) / 100 }));
                        }}
                        className="text-sm"
                      />
                      <span className="text-gray-500 text-sm">%</span>
                    </div>
                  </div>
                  <div className="text-gray-300 pt-5">/</div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Broker share</label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0" max="100"
                        value={brokerPct}
                        onChange={e => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                          setForm(f => ({ ...f, broker_split: val / 100 }));
                        }}
                        className="text-sm"
                      />
                      <span className="text-gray-500 text-sm">%</span>
                    </div>
                  </div>
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

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saveMutation.isPending} className="bg-[#013f7c] hover:bg-[#012d5a] text-white">
              {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Brokerage'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}