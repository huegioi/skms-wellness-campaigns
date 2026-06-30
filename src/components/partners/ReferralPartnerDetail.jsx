import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Check, User, DollarSign, Users, FileText, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import RecordSnapshotHeader from '@/components/shared/RecordSnapshotHeader';
import CollapsibleFieldSection from '@/components/shared/CollapsibleFieldSection';
import { InlineText } from '@/components/shared/inline/InlineText';
import { PARTNER_STAGES } from '@/components/shared/constants';

function TierField({ value, onSave, type = 'text', placeholder, step }) {
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  useEffect(() => { setDraft(value != null ? String(value) : ''); }, [value]);
  return (
    <input
      type={type}
      step={step}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        const val = type === 'number' ? (draft === '' ? null : parseFloat(draft)) : draft;
        if (val !== value) onSave(val);
      }}
      placeholder={placeholder}
      className="w-full bg-transparent border border-gray-200 rounded px-1.5 py-1 text-xs focus:border-[#013f7c] focus:outline-none"
    />
  );
}

export default function ReferralPartnerDetail({ partner: initialPartner, onClose }) {
  const queryClient = useQueryClient();
  const [partner, setPartner] = useState(initialPartner);
  const [copied, setCopied] = useState(false);

  const handleUpdate = async (updates) => {
    setPartner(prev => ({ ...prev, ...updates }));
    try {
      await base44.entities.ReferralPartner.update(initialPartner.id, updates);
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
    } catch (e) {
      setPartner(initialPartner);
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
    }
  };

  const { data: referrals = [] } = useQuery({
    queryKey: ['partnerReferrals', initialPartner.id],
    queryFn: () => base44.entities.Referral.filter({ referral_partner_id: initialPartner.id }, '-referral_date')
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients_for_partners'],
    queryFn: () => base44.entities.Client.list('-created_date', 500)
  });

  const linkedClients = allClients.filter(c => c.referral_partner_id === initialPartner.id);

  const handleToggleClient = async (client, link) => {
    if (link) {
      await base44.entities.Client.update(client.id, {
        referral_partner_id: initialPartner.id,
        referral_partner_name: partner.name,
      });
    } else {
      await base44.entities.Client.update(client.id, {
        referral_partner_id: null,
        referral_partner_name: null,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['clients_for_partners'] });
  };

  const handleTierFieldSave = (index, field, value) => {
    const tiers = [...(partner.commission_tiers || [])];
    tiers[index] = { ...tiers[index], [field]: value };
    handleUpdate({ commission_tiers: tiers });
  };

  const copyLink = () => {
    const url = `${window.location.origin}/ReferralPortal?id=${partner.unique_portal_id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalCommission = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partner Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <RecordSnapshotHeader
            record={partner}
            entityType="ReferralPartner"
            stages={PARTNER_STAGES}
            onUpdate={handleUpdate}
          />

          {/* Portal Actions */}
          <div className="flex gap-2 pt-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Portal Link'}
            </Button>
            <a href={`/ReferralPortal?id=${partner.unique_portal_id}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="w-4 h-4" /> Open Portal
              </Button>
            </a>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Referrals</p>
              <p className="text-xl font-bold text-[#013f7c]">{referrals.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Commission Earned</p>
              <p className="text-xl font-bold text-green-600">${totalCommission.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Linked Clients</p>
              <p className="text-xl font-bold text-blue-600">{linkedClients.length}</p>
            </div>
          </div>

          {/* Contact */}
          <CollapsibleFieldSection title="Contact" icon={User} defaultOpen>
            <div className="sm:col-span-2">
              <InlineText label="Email" value={partner.email} onSave={v => handleUpdate({ email: v })} />
            </div>
            <div className="sm:col-span-2">
              <InlineText label="Secondary Email" value={partner.email2} onSave={v => handleUpdate({ email2: v })} placeholder="Add secondary email" />
            </div>
            <InlineText label="Phone" value={partner.phone} onSave={v => handleUpdate({ phone: v })} />
            <div className="sm:col-span-2">
              <InlineText label="Address" value={partner.address} onSave={v => handleUpdate({ address: v })} />
            </div>
          </CollapsibleFieldSection>

          {/* Commission Tiers */}
          <CollapsibleFieldSection title="Commission Tiers" icon={DollarSign}>
            <div className="sm:col-span-2 space-y-2">
              <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-gray-400 px-1.5">
                <span>Label</span>
                <span>Min $</span>
                <span>Max $</span>
                <span>Rate</span>
              </div>
              {(partner.commission_tiers || []).map((tier, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-center">
                  <TierField value={tier.label} onSave={v => handleTierFieldSave(i, 'label', v)} placeholder="Label" />
                  <TierField value={tier.min_revenue} type="number" onSave={v => handleTierFieldSave(i, 'min_revenue', v)} placeholder="0" />
                  <TierField value={tier.max_revenue} type="number" onSave={v => handleTierFieldSave(i, 'max_revenue', v)} placeholder="∞" />
                  <div className="flex items-center gap-1">
                    <TierField value={tier.rate} type="number" step="0.001" onSave={v => handleTierFieldSave(i, 'rate', v)} placeholder="0.125" />
                    <span className="text-xs text-gray-500 shrink-0">
                      {tier.rate != null ? `${(tier.rate * 100 % 1 === 0 ? (tier.rate * 100).toFixed(0) : (tier.rate * 100).toFixed(1))}%` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleFieldSection>

          {/* Linked Clients */}
          <CollapsibleFieldSection title="Linked Clients" icon={Users}>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 mb-2">Clients referred by this partner. Their revenue counts toward commission tiers.</p>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y bg-gray-50">
                {allClients.length === 0 && <p className="text-xs text-gray-400 p-3">No clients found.</p>}
                {allClients.map(c => {
                  const checked = c.referral_partner_id === initialPartner.id;
                  return (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => handleToggleClient(c, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-800">{c.company || c.name}</span>
                      {c.name && c.company && (
                        <span className="text-xs text-gray-400">— {c.name}</span>
                      )}
                      {c.referral_partner_id && c.referral_partner_id !== initialPartner.id && (
                        <span className="text-xs text-orange-500 ml-auto">linked to another partner</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </CollapsibleFieldSection>

          {/* Agreement */}
          <CollapsibleFieldSection title="Agreement" icon={FileText}>
            <div className="sm:col-span-2">
              <InlineText label="Agreement File URL" value={partner.agreement_file_url} onSave={v => handleUpdate({ agreement_file_url: v })} placeholder="https://..." />
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Signed Date</span>
              <input
                type="date"
                value={partner.agreement_signed_date || ''}
                onChange={e => handleUpdate({ agreement_signed_date: e.target.value })}
                className="w-full bg-transparent text-sm text-gray-700 border-0 p-0 focus:outline-none cursor-pointer"
              />
            </div>
          </CollapsibleFieldSection>

          {/* Notes */}
          <CollapsibleFieldSection title="Notes" icon={StickyNote}>
            <div className="sm:col-span-2">
              <InlineText multiline value={partner.notes} onSave={v => handleUpdate({ notes: v })} placeholder="Add notes..." />
            </div>
          </CollapsibleFieldSection>

          {/* Referrals (read-only) */}
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Referrals ({referrals.length})</h3>
            </div>
            {referrals.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No referrals yet.</p>
            ) : (
              <div className="space-y-2">
                {referrals.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium text-gray-800">{r.contact_name}</span>
                      {r.company_name && <span className="text-gray-500 ml-1">— {r.company_name}</span>}
                      <span className="text-gray-400 ml-2 text-xs">
                        {r.referral_date ? format(new Date(r.referral_date), 'MMM d, yyyy') : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.commission_amount > 0 && (
                        <span className="text-xs text-green-700 font-medium">${r.commission_amount.toLocaleString()}</span>
                      )}
                      <Badge className={
                        r.status === 'commission_paid' ? 'bg-purple-100 text-purple-700' :
                        r.status === 'purchased' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'converted_to_client' ? 'bg-green-100 text-green-700' :
                        r.status === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }>
                        {r.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}