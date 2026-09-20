import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Check, User, DollarSign, Users, FileText, StickyNote, RefreshCw, Mail, Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import RecordSnapshotHeader from '@/components/shared/RecordSnapshotHeader';
import CollapsibleFieldSection from '@/components/shared/CollapsibleFieldSection';
import { InlineText } from '@/components/shared/inline/InlineText';
import { PARTNER_STAGES } from '@/components/shared/constants';
import { REFERRAL_STATUS_COLORS } from '@/lib/statusConfig';
import InteractionTimeline from '@/components/shared/InteractionTimeline';
import CommissionPaymentsLedger from '@/components/partners/CommissionPaymentsLedger';
import BrokeragePicker from '@/components/partners/BrokeragePicker';
import { setMayaRecordContext, clearMayaRecordContext } from '@/lib/mayaOrbStore';

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
  const { data: partner = initialPartner } = useQuery({
    queryKey: ['partner', initialPartner.id],
    queryFn: async () => {
      const partners = await base44.entities.ReferralPartner.filter({ id: initialPartner.id });
      return partners[0] || initialPartner;
    },
    initialData: initialPartner
  });
  const [copied, setCopied] = useState(false);
  const [sendEmailConfirm, setSendEmailConfirm] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [regenerateConfirm, setRegenerateConfirm] = useState(null);
  const [regenerating, setRegenerating] = useState(null);

  const sendPortalEmail = async (partner) => {
    setSendingEmail(partner.id);
    setSendEmailConfirm(null);
    try {
      await base44.functions.invoke('provisionPartnerPortalOnActivation', {
        event: { type: 'manual' },
        data: { ...partner, unique_portal_id: partner.unique_portal_id },
        send_email: true,
      });
      toast.success('Portal email sent!', { description: `Sent to ${partner.email}` });
    } catch (e) {
      toast.error('Failed to send email', { description: e.message });
    } finally {
      setSendingEmail(null);
    }
  };

  const regeneratePortalLink = async (partner) => {
    setRegenerating(partner.id);
    setRegenerateConfirm(null);
    try {
      const res = await base44.functions.invoke('regeneratePartnerPortalId', { partner_id: partner.id });
      const newUrl = `${window.location.origin}/ReferralPortal?id=${res.data.portal_id}`;
      navigator.clipboard.writeText(newUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      toast.success('Portal link regenerated', { description: 'New link copied to clipboard.' });
    } catch (e) {
      toast.error('Failed to regenerate link', { description: e.message });
    } finally {
      setRegenerating(null);
    }
  };

  useEffect(() => {
    if (initialPartner?.id && initialPartner?.name) {
      setMayaRecordContext({ recordType: 'partner', recordId: initialPartner.id, recordName: initialPartner.name });
    }
    return () => clearMayaRecordContext();
  }, [initialPartner?.id, initialPartner?.name]);

  const handleUpdate = async (updates) => {
    queryClient.setQueryData(['partner', initialPartner.id], old => old ? { ...old, ...updates } : old);
    try {
      await base44.entities.ReferralPartner.update(initialPartner.id, updates);
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      queryClient.invalidateQueries({ queryKey: ['partner', initialPartner.id] });
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ['partner', initialPartner.id] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      throw e;
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

  const earnedAmt = (r) => partner.brokerage_id ? (r.broker_commission != null ? (r.broker_commission || 0) : (r.commission_amount || 0)) : (r.commission_amount || 0);
  const hasUnsplit = !!partner.brokerage_id && referrals.some(r => r.broker_commission == null && (r.commission_amount || 0) > 0);
  const totalCommission = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const earnedCommission = referrals.reduce((sum, r) => sum + earnedAmt(r), 0);

  // ── Responsive dialog layout (see RecordDetailFrame) ──
  // Header: snapshot + portal actions. Rail: the numbers, agreement, and the
  // linked-client list. Main: tabs — Overview (contact, brokerage, notes),
  // Commissions (tiers + payments), Referrals, Activity. Replaces the former
  // single long scroll of collapsible sections.
  const [activeTab, setActiveTab] = useState('overview');

  const header = (
    <>
      <DialogTitle className="sr-only">{partner.name}</DialogTitle>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <RecordSnapshotHeader
            record={partner}
            entityType="ReferralPartner"
            stages={PARTNER_STAGES}
            onUpdate={handleUpdate}
          />
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:pr-8 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 justify-start" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Portal Link'}
          </Button>
          <a href={`/ReferralPortal?id=${partner.unique_portal_id}`} target="_blank" rel="noopener noreferrer" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 justify-start w-full">
              <ExternalLink className="w-4 h-4" /> Open Portal
            </Button>
          </a>
          {partner.unique_portal_id && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 justify-start text-blue-700 border-blue-200 hover:bg-blue-50"
                onClick={() => setSendEmailConfirm(partner)}
                disabled={sendingEmail === partner.id}
              >
                <Mail className="w-4 h-4" />
                {sendingEmail === partner.id ? 'Sending…' : 'Send Portal Email'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 justify-start text-orange-700 border-orange-200 hover:bg-orange-50"
                onClick={() => setRegenerateConfirm(partner)}
                disabled={regenerating === partner.id}
              >
                <RefreshCw className={`w-4 h-4 ${regenerating === partner.id ? 'animate-spin' : ''}`} />
                {regenerating === partner.id ? 'Regenerating…' : 'Regenerate Link'}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );

  const rail = (
    <>
      <div className="grid grid-cols-3 lg:grid-cols-1 gap-2.5">
        <StatTile label="Referrals" value={referrals.length} />
        <StatTile
          label="Commission Earned"
          value={`$${earnedCommission.toLocaleString()}`}
          color="#16a34a"
          sub={
            partner.brokerage_id && totalCommission > 0
              ? `Total (house + broker): $${totalCommission.toLocaleString()}${hasUnsplit ? ' · unsplit — run backfill' : ''}`
              : hasUnsplit ? 'unsplit — run backfill' : undefined
          }
        />
        <StatTile label="Linked Clients" value={linkedClients.length} color="#2563eb" />
      </div>

      <RailSection title="Agreement" icon={FileText}>
        <div className="space-y-2">
          <InlineText label="Agreement File URL" value={partner.agreement_file_url} onSave={v => handleUpdate({ agreement_file_url: v })} placeholder="https://..." />
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Signed Date</span>
            <input
              type="date"
              value={partner.agreement_signed_date || ''}
              onChange={e => handleUpdate({ agreement_signed_date: e.target.value })}
              className="w-full bg-transparent text-sm text-gray-700 border-0 p-0 focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </RailSection>

      <RailSection title={`Linked clients (${linkedClients.length})`} icon={Users}>
        <p className="text-[11px] text-gray-400 mb-2">Clients referred by this partner. Their revenue counts toward commission tiers.</p>
        <div className="max-h-56 overflow-y-auto border rounded-lg divide-y bg-gray-50">
          {allClients.length === 0 && <p className="text-xs text-gray-400 p-3">No clients found.</p>}
          {[...allClients]
            .sort((a, b) => (b.referral_partner_id === initialPartner.id) - (a.referral_partner_id === initialPartner.id))
            .map(c => {
              const checked = c.referral_partner_id === initialPartner.id;
              return (
                <label key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-white cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => handleToggleClient(c, e.target.checked)}
                    className="rounded shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-800 truncate">{c.company || c.name}</span>
                  {c.referral_partner_id && c.referral_partner_id !== initialPartner.id && (
                    <span className="text-[10px] text-orange-500 ml-auto shrink-0">other partner</span>
                  )}
                </label>
              );
            })}
        </div>
      </RailSection>
    </>
  );

  return (
    <>
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <RecordDetailContent maxWidth="1120px" aria-describedby={undefined}>
        <RecordDetailFrame header={header} rail={rail}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-1 justify-start bg-muted p-1 rounded-lg">
              <TabsTrigger value="overview" className="flex-shrink-0 text-sm">Overview</TabsTrigger>
              <TabsTrigger value="commissions" className="flex-shrink-0 text-sm">Commissions</TabsTrigger>
              <TabsTrigger value="referrals" className="flex-shrink-0 text-sm">Referrals ({referrals.length})</TabsTrigger>
              <TabsTrigger value="activity" className="flex-shrink-0 text-sm">Activity</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-2 mt-4">
              <CollapsibleFieldSection title="Contact" icon={User} defaultOpen>
                <div className="sm:col-span-2">
                  <InlineText label="Email" value={partner.email} onSave={v => handleUpdate({ email: v })} />
                </div>
                <div className="sm:col-span-2">
                  <InlineText label="Secondary Email" value={partner.email2} onSave={v => handleUpdate({ email2: v })} placeholder="Add secondary email" />
                </div>
                <InlineText label="Phone" value={partner.phone} onSave={v => handleUpdate({ phone: v })} />
                <div className="sm:col-span-2">
                  <InlineText label="LinkedIn URL" value={partner.linkedin_url} onSave={v => handleUpdate({ linkedin_url: v })} placeholder="https://linkedin.com/in/..." />
                </div>
                {partner.linkedin_url && (
                  <div className="sm:col-span-2">
                    <a href={partner.linkedin_url.startsWith('http') ? partner.linkedin_url : `https://${partner.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#0a66c2] hover:underline">
                      <Linkedin className="w-4 h-4" />Open LinkedIn Profile
                    </a>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <InlineText label="Address" value={partner.address} onSave={v => handleUpdate({ address: v })} />
                </div>
                {/* Brokerage */}
                <div className="sm:col-span-2">
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Brokerage</span>
                  <BrokeragePicker
                    value={partner.brokerage_id}
                    onChange={v => handleUpdate({ brokerage_id: v })}
                    contactEmail={partner.email}
                  />
                </div>
              </CollapsibleFieldSection>

              <CollapsibleFieldSection title="Notes" icon={StickyNote} defaultOpen>
                <div className="sm:col-span-2">
                  <InlineText multiline value={partner.notes} onSave={v => handleUpdate({ notes: v })} placeholder="Add notes..." />
                </div>
              </CollapsibleFieldSection>
            </TabsContent>

            {/* Commissions */}
            <TabsContent value="commissions" className="space-y-2 mt-4">
              <CollapsibleFieldSection title="Commission Payments" icon={DollarSign} defaultOpen>
                <div className="sm:col-span-2 space-y-3">
                  <CommissionPaymentsLedger partnerId={initialPartner.id} />
                </div>
              </CollapsibleFieldSection>

              <CollapsibleFieldSection title="Commission Tiers" icon={DollarSign} defaultOpen>
                <div className="sm:col-span-2 space-y-2">
                  {partner.brokerage_id && (
                    <p className="text-xs text-gray-400">This partner belongs to a brokerage — the brokerage's tiers apply; these solo tiers are kept for reference.</p>
                  )}
                  <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-gray-400 px-1.5">
                    <span>Label</span>
                    <span>Min $</span>
                    <span>Max $</span>
                    <span>Rate</span>
                  </div>
                  {(partner.commission_tiers || []).length === 0 && (
                    <p className="text-xs text-gray-400 px-1.5">No tiers defined.</p>
                  )}
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
            </TabsContent>

            {/* Referrals (read-only) */}
            <TabsContent value="referrals" className="mt-4">
              {referrals.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center border rounded-lg">No referrals yet.</p>
              ) : (
                <div className="space-y-2">
                  {referrals.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-800">{r.contact_name}</span>
                        {r.company_name && <span className="text-gray-500 ml-1">— {r.company_name}</span>}
                        <span className="text-gray-400 ml-2 text-xs whitespace-nowrap">
                          {r.referral_date ? format(new Date(r.referral_date), 'MMM d, yyyy') : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {earnedAmt(r) > 0 && (
                          <span className="text-xs text-green-700 font-medium">${earnedAmt(r).toLocaleString()}</span>
                        )}
                        <Badge className={REFERRAL_STATUS_COLORS[r.status] || 'bg-blue-100 text-blue-700'}>
                          {r.status?.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Activity Timeline */}
            <TabsContent value="activity" className="mt-4">
              <InteractionTimeline referral_partner_id={initialPartner.id} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['referralPartners'] })} />
            </TabsContent>
          </Tabs>
        </RecordDetailFrame>
      </RecordDetailContent>
    </Dialog>

    {/* Send Email Confirmation */}
    <Dialog open={!!sendEmailConfirm} onOpenChange={v => { if (!v) setSendEmailConfirm(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Send Portal Access Email?</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600 mt-2">
          This will send a portal access email to <strong>{sendEmailConfirm?.name}</strong> at <strong>{sendEmailConfirm?.email}</strong> with their private portal link.
        </p>
        <div className="flex gap-3 mt-4">
          <Button onClick={() => sendPortalEmail(sendEmailConfirm)} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
            <Mail className="w-4 h-4" /> Yes, Send Email
          </Button>
          <Button variant="outline" onClick={() => setSendEmailConfirm(null)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Regenerate Confirmation */}
    <Dialog open={!!regenerateConfirm} onOpenChange={v => { if (!v) setRegenerateConfirm(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Regenerate Portal Link?</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600 mt-2">
          This will invalidate the partner's current portal link. Continue?
        </p>
        <div className="flex gap-3 mt-4">
          <Button onClick={() => regeneratePortalLink(regenerateConfirm)} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
            <RefreshCw className="w-4 h-4" /> Yes, Regenerate
          </Button>
          <Button variant="outline" onClick={() => setRegenerateConfirm(null)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
