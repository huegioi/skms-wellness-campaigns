import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_TIERS = [
  { label: 'Introducing Partner', min_revenue: 0, max_revenue: 74999, rate: 0.10 },
  { label: 'Active Partner', min_revenue: 75000, max_revenue: 149999, rate: 0.125 },
  { label: 'Strategic Partner', min_revenue: 150000, max_revenue: null, rate: 0.15 },
];

const EMPTY_FORM = {
  name: '',
  company: '',
  notes: '',
  commission_tiers: DEFAULT_TIERS,
  brokerage_commission_enabled: true,
  broker_commission_enabled: true,
  broker_split: 0.5,
};

export default function BrokerageDialog({ open, onOpenChange, editing, onSaved }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name || '',
          company: editing.company || '',
          notes: editing.notes || '',
          commission_tiers: editing.commission_tiers || DEFAULT_TIERS,
          brokerage_commission_enabled: editing.brokerage_commission_enabled !== false,
          broker_commission_enabled: editing.broker_commission_enabled !== false,
          broker_split: editing.broker_split ?? 0.5,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [editing, open]);

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
        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-5 mt-2">
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