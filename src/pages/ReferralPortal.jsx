import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Users, DollarSign, FileText, Plus, CheckCircle, Clock, TrendingUp, ExternalLink, AlertCircle, Gift, ChevronDown, BarChart3, ArrowLeft, BookOpen, ChevronRight, PlayCircle, Star, Download, Brain, Wrench } from 'lucide-react';
import ROIDashboard from '@/components/portal/ROIDashboard';
import BrokerFeedbackRollup from '@/components/portal/BrokerFeedbackRollup';
import TierProgress from '@/components/portal/TierProgress';
import ReferralStepper from '@/components/portal/ReferralStepper';
import RecentActivity from '@/components/portal/RecentActivity';
import { PortalShell, PortalLoading, PortalError } from '@/components/portal/PortalShell';
import MfsPromoCard from '@/components/portal/MfsPromoCard';
import PartnerToolsTab from '@/components/portal/PartnerToolsTab';
import { REFERRAL_STATUS_COLORS as STATUS_COLORS, REFERRAL_STATUS_LABELS as STATUS_LABELS } from '@/lib/statusConfig';

const TABS = [
  { key: 'start_here', label: 'Start Here', icon: BookOpen },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'tools', label: 'Tools', icon: Wrench },
  { key: 'commissions', label: 'Commissions', icon: DollarSign },
];

export default function ReferralPortal() {
  const [searchParams] = useSearchParams();
  const portalId = searchParams.get('id');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ contact_name: '', contact_email: '', company_name: '', notes: '', proposal_id: '' });
  const [submitError, setSubmitError] = useState(null);

  const updateForm = (updater) => { setForm(updater); setSubmitError(null); };
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [selectedClientROI, setSelectedClientROI] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showOlder, setShowOlder] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  useEffect(() => {
    if (!portalId) { setError('No portal ID provided.'); setLoading(false); return; }
    loadData();
  }, [portalId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getReferralPortalData', { portal_id: portalId });
      if (res.data && res.data.partner) {
        setData(res.data);
        // New partners (zero referrals) land on Start Here; returning partners go straight to Dashboard.
        if (!res.data.referrals || res.data.referrals.length === 0) {
          setActiveTab('start_here');
        }
      } else {
        setError('Portal not found.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load portal.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.contact_name) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await base44.functions.invoke('createReferral', { portal_id: portalId, ...form });
      setSubmitted(true);
      setShowForm(false);
      setForm({ contact_name: '', contact_email: '', company_name: '', notes: '', proposal_id: '' });
      await loadData();
    } catch (err) {
      console.error('Failed to submit referral:', err);
      setSubmitError('Something went wrong submitting your referral — please try again or email us.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return <PortalLoading accentColor="#013f7c" />;
  }

  if (error || !data) {
    return (
      <PortalError
        heading="Portal Not Found"
        message="This portal link is invalid or has expired. Please contact your SKMS Wellness representative."
      />
    );
  }

  const { partner, referrals, commission_summary = {}, client_companies = [], partner_proposals = [], commission_ledger = [], activities = [], brokerage = null } = data;
  const tiers = partner.commission_tiers || [];
  const commissionsEnabled = partner.commissions_enabled !== false;
  const visibleTabs = commissionsEnabled ? TABS : TABS.filter(t => t.key !== 'commissions');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const availableStatuses = [...new Set(referrals.map(r => r.status))].filter(Boolean);
  const filteredReferrals = referrals.filter(r => statusFilter === 'all' || r.status === statusFilter);
  const recentReferrals = filteredReferrals.filter(r => !r.referral_date || new Date(r.referral_date) >= twelveMonthsAgo);
  const olderReferrals = filteredReferrals.filter(r => r.referral_date && new Date(r.referral_date) < twelveMonthsAgo);

  const renderReferralRow = (r, i) => (
    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-gray-50 border gap-3">
      <div>
        <p className="font-semibold text-gray-800">{r.contact_name}</p>
        {r.company_name && <p className="text-sm text-gray-500">{r.company_name}</p>}
        {r.contact_email && <p className="text-xs text-gray-400">{r.contact_email}</p>}
        <p className="text-xs text-gray-400 mt-1">{format(new Date(r.referral_date), 'MMM d, yyyy')}</p>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-2">
        <div className="flex items-center gap-1.5">
          {r.is_mfs && (
            <Badge className="bg-[#770142]/10 text-[#770142] gap-1">
              <Brain className="w-3 h-3" />
              Assessment
            </Badge>
          )}
          <Badge className={STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}>
            {STATUS_LABELS[r.status] || r.status}
          </Badge>
        </div>
        {commissionsEnabled && r.commission_amount > 0 && (
          <span className="text-sm font-semibold text-green-700">${r.commission_amount.toLocaleString()} commission</span>
        )}
      </div>
      <ReferralStepper status={r.status} commissionsEnabled={commissionsEnabled} />
    </div>
  );

  const exportCommissionCSV = () => {
    const quote = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const headers = ['Company', 'Status', 'Revenue Placed', 'Commission Rate', 'Commission Earned', 'Referral Date'];
    const rows = commission_ledger.map(row => [
      row.company || '',
      STATUS_LABELS[row.status] || row.status || '',
      row.first_year_revenue || 0,
      row.commission_rate ? `${(row.commission_rate * 100).toFixed(1)}%` : '',
      row.commission_earned || 0,
      row.referral_date ? format(new Date(row.referral_date), 'yyyy-MM-dd') : ''
    ]);
    const totalRevenue = commission_ledger.reduce((s, r) => s + (r.first_year_revenue || 0), 0);
    rows.push(['Total', '', totalRevenue, '', commission_summary.total_earned || 0, '']);
    const csv = [headers, ...rows].map(r => r.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeName = (partner.name || 'partner').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const a = document.createElement('a');
    a.href = url;
    a.download = `skms-commissions-${safeName}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PortalShell
      accentColor="#013f7c"
      eyebrow="Referral Partner Portal"
      title={partner.name}
      subtitle={partner.company}
      logo={false}
      maxWidth="max-w-4xl"
      headerPadding="py-6 px-4"
      subtitleClass="text-blue-200"
      headerExtra={!partner.is_active ? <Badge className="mt-2 bg-red-500 text-white">Inactive Partnership</Badge> : null}
      tabs={visibleTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      contentClass="px-4 py-8 space-y-6"
    >

        {/* ─── DASHBOARD TAB ─── */}
        {activeTab === 'dashboard' && (
          <>
            {/* MFS Promo Card */}
            <MfsPromoCard uniquePortalId={partner.unique_portal_id} partnerName={partner.name} compact />

            {/* Portfolio Wellness Impact */}
            <BrokerFeedbackRollup clientCompanies={client_companies} services={services} portalId={portalId} />

            {/* Recent Activity */}
            <RecentActivity activities={activities} />

            {/* Submit a Referral */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="w-5 h-5 text-brand-green" />
                    Submit a Referral
                  </CardTitle>
                  {!showForm && (
                    <Button onClick={() => { setShowForm(true); setSubmitted(false); }} className="bg-brand-green hover:bg-[#1e3a33] text-white">
                      New Referral
                    </Button>
                  )}
                </div>
              </CardHeader>
              {submitted && !showForm && (
                <CardContent>
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Referral submitted successfully! We'll be in touch soon.</span>
                  </div>
                </CardContent>
              )}
              {showForm && (
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Contact Name *</label>
                        <Input value={form.contact_name} onChange={e => updateForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Full name" required />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Contact Email</label>
                        <Input type="email" value={form.contact_email} onChange={e => updateForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="email@company.com" />
                      </div>
                      <div className="relative">
                        <label className="text-sm font-medium text-gray-700 block mb-1">Company Name</label>
                        <div className="flex gap-1">
                          <Input
                            value={form.company_name}
                            onChange={e => updateForm(f => ({ ...f, company_name: e.target.value, proposal_id: '' }))}
                            placeholder="Company or organization"
                            onFocus={() => setCompanyDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setCompanyDropdownOpen(false), 150)}
                          />
                          {client_companies.length > 0 && (
                            <button
                              type="button"
                              className="border border-input bg-background rounded-md px-2 hover:bg-accent shrink-0"
                              onMouseDown={e => { e.preventDefault(); setCompanyDropdownOpen(o => !o); }}
                            >
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            </button>
                          )}
                        </div>
                        {companyDropdownOpen && client_companies.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {client_companies
                              .filter(c => !form.company_name || c.company.toLowerCase().includes(form.company_name.toLowerCase()))
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                                  onMouseDown={() => { updateForm(f => ({ ...f, company_name: c.company, proposal_id: '' })); setCompanyDropdownOpen(false); }}
                                >
                                  <span className="font-medium">{c.company}</span>
                                  {c.name && c.name !== c.company && <span className="text-gray-400 ml-1 text-xs">— {c.name}</span>}
                                </button>
                              ))
                            }
                          </div>
                        )}
                      </div>
                      {(() => {
                        const matchedClient = client_companies.find(c => c.company.toLowerCase() === form.company_name.toLowerCase());
                        const availableProposals = partner_proposals.filter(p => matchedClient && p.client_id === matchedClient.id);
                        if (!matchedClient || availableProposals.length === 0) return null;
                        return (
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">Link a Proposal (optional)</label>
                            <select
                              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white"
                              value={form.proposal_id}
                              onChange={e => updateForm(f => ({ ...f, proposal_id: e.target.value }))}
                            >
                              <option value="">No proposal linked</option>
                              {availableProposals.map(p => (
                                <option key={p.id} value={p.id}>
                                  ${p.total_amount?.toLocaleString()} · {p.status} · {p.created_date ? new Date(p.created_date).toLocaleDateString() : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
                      <Textarea value={form.notes} onChange={e => updateForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any context about this referral..." rows={3} />
                    </div>
                    {submitError && (
                      <p className="text-sm text-red-600 font-medium">{submitError}</p>
                    )}
                    <div className="flex gap-3">
                      <Button type="submit" disabled={submitting} className="bg-brand-navy hover:bg-[#012d5a] text-white">
                        {submitting ? 'Submitting...' : 'Submit Referral'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                    </div>
                  </form>
                </CardContent>
              )}
            </Card>

            {/* Referrals Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-5 h-5 text-brand-navy" />
                  Your Referrals ({referrals.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No referrals submitted yet. Use the button above to submit your first referral!</p>
                ) : (
                  <div className="space-y-3">
                    {/* Status filter */}
                    {availableStatuses.length > 1 && (
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => setStatusFilter('all')}
                          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${statusFilter === 'all' ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          All ({referrals.length})
                        </button>
                        {availableStatuses.map(status => (
                          <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${statusFilter === status ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {STATUS_LABELS[status] || status} ({referrals.filter(r => r.status === status).length})
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Recent referrals */}
                    {recentReferrals.map((r, i) => renderReferralRow(r, i))}

                    {/* No recent matches */}
                    {recentReferrals.length === 0 && filteredReferrals.length > 0 && (
                      <p className="text-center text-gray-400 py-4 text-sm">No referrals match this filter in the last 12 months.</p>
                    )}

                    {/* Older referrals collapse */}
                    {olderReferrals.length > 0 && (
                      <>
                        {!showOlder ? (
                          <button
                            onClick={() => setShowOlder(true)}
                            className="w-full text-center py-2 text-sm text-gray-500 hover:text-brand-navy border border-dashed border-gray-300 rounded-lg hover:border-brand-navy/30 transition-colors"
                          >
                            Show older ({olderReferrals.length})
                          </button>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Older than 12 months</p>
                            {olderReferrals.map((r, i) => renderReferralRow(r, `older-${i}`))}
                            <button
                              onClick={() => setShowOlder(false)}
                              className="w-full text-center py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              Hide older
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Book of Business — ROI Drill-Down */}
            {client_companies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-5 h-5 text-brand-navy" />
                    Book of Business — Client ROI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedClientROI ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedClientROI(null)} className="gap-1 text-xs text-gray-500">
                          <ArrowLeft className="w-3 h-3" /> All Clients
                        </Button>
                        <span className="text-sm font-semibold text-gray-700">{selectedClientROI.company}</span>
                      </div>
                      <ROIDashboard
                        clientId={selectedClientROI.id}
                        clientCompany={selectedClientROI.company}
                        services={services}
                        portalId={portalId}
                        showReportButton={true}
                        onGenerateReport={() => window.open(`${window.location.origin}/ClientReport?client_id=${selectedClientROI.id}&portal_id=${portalId}`, '_blank')}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 mb-3">Click any client to view their wellness ROI data and generate a report.</p>
                      {client_companies.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedClientROI(c)}
                          className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-brand-navy/20 transition-all group"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{c.company}</p>
                            {c.name && c.name !== c.company && <p className="text-xs text-gray-400">{c.name}</p>}
                          </div>
                          <span className="text-xs text-gray-400 group-hover:text-brand-navy">View ROI →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <p className="text-center text-xs text-gray-400 pb-4">SKMS Wellness · Referral Partner Portal</p>
          </>
        )}

        {/* ─── START HERE TAB ─── */}
        {activeTab === 'start_here' && (
          <div className="space-y-6">
            {/* Welcome */}
            <Card className="border-[#e6e1d8] bg-[#f9f8f5] border-l-4 border-l-brand-navy">
              <CardContent className="pt-6 pb-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(1,63,124,0.08)' }}>
                    <Star className="w-8 h-8 text-brand-navy" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-brand-navy">Welcome to Your Partner Portal, {partner.name.split(' ')[0]}!</h2>
                    <p className="text-gray-600 text-sm mt-1">Everything you need to track referrals, view client ROI, and grow your partnership with SKMS Wellness — all in one place.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MFS Promo Card */}
            <MfsPromoCard uniquePortalId={partner.unique_portal_id} partnerName={partner.name} />

            {/* How to Use This Portal */}
            <Card className="border-[#e6e1d8] bg-[#f9f8f5] border-l-4 border-l-brand-navy">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-brand-navy">
                  <BookOpen className="w-5 h-5 text-brand-navy" />
                  How to Use This Portal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: '1', title: 'Track Your Referrals', desc: commissionsEnabled ? 'On the Dashboard tab, see every referral you\'ve submitted and its current status — from initial contact all the way to commission paid.' : 'On the Dashboard tab, see every referral you\'ve submitted and its current status — from initial contact to purchased.' },
                    { step: '2', title: 'View Client ROI Data', desc: 'In the "Book of Business" section, click any of your active clients to see NPS scores, stress reduction metrics, and session feedback from their employees.' },
                    { step: '3', title: 'Generate Client Reports', desc: 'Inside each client\'s ROI view, hit "Generate Report" to open a print-ready report you can share directly with the client\'s HR team.' },
                    { step: '4', title: 'Submit New Referrals', desc: 'Use the "Submit a Referral" section on the dashboard. A first name and company is enough to get started — we take it from there.' },
                    ...(commissionsEnabled ? [{ step: '5', title: 'Review Your Commission Earnings', desc: 'Your live commission totals, YTD revenue placed, and pending balance are always visible on the Commissions tab.' }] : []),
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0 bg-brand-navy">
                        {step}
                      </div>
                      <div>
                        <p className="font-semibold text-brand-navy text-sm">{title}</p>
                        <p className="text-gray-600 text-sm mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How the Program Works */}
            <Card className="border-[#e6e1d8] bg-[#f9f8f5] border-l-4 border-l-brand-navy">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-brand-navy">
                  <TrendingUp className="w-5 h-5 text-brand-navy" />
                  How the Program Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className={`grid grid-cols-1 gap-3 ${commissionsEnabled ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                  {[
                    { num: '01', text: 'You flag a client opportunity — a quick email is fine' },
                    { num: '02', text: 'We confirm pipeline status within 5 business days' },
                    { num: '03', text: 'You introduce — we handle discovery, proposal, delivery' },
                    ...(commissionsEnabled
                      ? [{ num: '04', text: 'Commission paid within 30 days of client invoice' }, { num: '05', text: 'Quarterly partner statement with all placements' }]
                      : [{ num: '04', text: 'Quarterly partner statement with all placements' }]
                    ),
                  ].map(s => (
                    <div key={s.num} className="bg-brand-cream rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-brand-navy mb-1">{s.num}</p>
                      <p className="text-xs text-gray-600">{s.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* SKMS Program Offerings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gift className="w-5 h-5 text-brand-green" />
                  What We Offer Your Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">These are the core programs your referred clients can access through SKMS Wellness:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: 'Interactive Workshops', desc: '60–90 minute live sessions on stress, resilience, sleep, and mental performance. Virtual or in-person.' },
                    { name: '14-Day Team Challenges', desc: 'Structured micro-habit programs that drive daily engagement and measurable behavior change.' },
                    { name: 'Leadership EQ Programs', desc: 'Emotional intelligence and pressure management training built for managers and executives.' },
                    { name: 'Mindful Movement Classes', desc: 'Guided breathwork, yoga, and movement sessions that reduce absenteeism triggers.' },
                    { name: 'Wellness Boxes', desc: 'Physical or digital curated boxes with tools and resources to reinforce program takeaways.' },
                    { name: 'Annual Workshop for You', desc: 'Every partner gets a complimentary workshop for their own team — virtual or in-person.' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-white rounded-lg border border-[#e6e1d8]">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-brand-navy" style={{ backgroundColor: 'rgba(1,63,124,0.08)' }}>{item.name}</span>
                      <p className="text-xs text-gray-600 mt-2">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="text-center pb-2">
              <Button onClick={() => setActiveTab('dashboard')} className="bg-brand-navy hover:bg-[#012d5a] text-white gap-2">
                Go to Dashboard <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── TOOLS TAB ─── */}
        {activeTab === 'tools' && (
          <PartnerToolsTab refCode={partner.unique_portal_id} />
        )}

        {/* ─── COMMISSIONS TAB ─── */}
        {activeTab === 'commissions' && (
          <div className="space-y-6">
            {/* Top-line KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-[#e6e1d8] bg-[#f9f8f5]">
                <CardContent className="pt-5 pb-4">
                  <div className="inline-flex p-2 rounded-lg mb-3" style={{ backgroundColor: 'rgba(1,63,124,0.08)' }}>
                    <DollarSign className="w-5 h-5 text-brand-navy" />
                  </div>
                  <p className="text-3xl font-bold text-brand-navy">${(commission_summary.total_earned || 0).toLocaleString()}</p>
                  <p className="text-sm text-brand-navy font-medium mt-1">Total Earned (All-Time)</p>
                </CardContent>
              </Card>
              <Card className="border-[#e6e1d8] bg-[#f9f8f5]">
                <CardContent className="pt-5 pb-4">
                  <div className="inline-flex p-2 rounded-lg mb-3" style={{ backgroundColor: 'rgba(1,63,124,0.08)' }}>
                    <Clock className="w-5 h-5 text-brand-navy" />
                  </div>
                  <p className="text-3xl font-bold text-gray-700">${(commission_summary.pending || 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-600 font-medium mt-1">Pending / Unpaid</p>
                </CardContent>
              </Card>
              <Card className="border-[#e6e1d8] bg-[#f9f8f5]">
                <CardContent className="pt-5 pb-4">
                  <div className="inline-flex p-2 rounded-lg mb-3" style={{ backgroundColor: 'rgba(38,77,68,0.10)' }}>
                    <TrendingUp className="w-5 h-5 text-brand-green" />
                  </div>
                  <p className="text-3xl font-bold text-brand-green">${(commission_summary.ytd_revenue || 0).toLocaleString()}</p>
                  <p className="text-sm text-brand-green font-medium mt-1">YTD Revenue Placed</p>
                </CardContent>
              </Card>
            </div>

            {/* Tier Progress */}
            <TierProgress tiers={tiers} commissionSummary={commission_summary} brokerageName={brokerage?.name} />

            {/* Per-Client Commission Ledger */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-brand-navy" />
                    Commission Ledger — By Client
                  </CardTitle>
                  {commission_ledger.length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCommissionCSV}>
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {commission_ledger.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No commission data yet. Revenue and commission amounts are updated when referrals are reviewed and invoiced.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                          <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Revenue Placed</th>
                          <th className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Rate</th>
                          <th className="pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Commission Earned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {commission_ledger.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-800">{row.company}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                                row.status === 'commission_paid' ? 'bg-brand-navy/10 text-brand-navy' :
                                row.status === 'purchased' || row.status === 'converted_to_client' ? 'bg-brand-green/10 text-brand-green' :
                                row.status === 'not_eligible' ? 'bg-gray-100 text-gray-500' :
                                'bg-brand-navy/8 text-brand-navy'
                              }`}>
                                {STATUS_LABELS[row.status] || row.status}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-700">
                              {row.first_year_revenue > 0 ? `$${row.first_year_revenue.toLocaleString()}` : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-500">
                              {row.commission_rate ? `${(row.commission_rate * 100).toFixed(1)}%` : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-3 text-right font-semibold">
                              {row.commission_earned > 0
                                ? <span className="text-brand-navy">${row.commission_earned.toLocaleString()}</span>
                                : <span className="text-gray-300">$0</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200">
                          <td className="pt-3 font-semibold text-gray-700">Total</td>
                          <td className="pt-3 text-right font-semibold text-gray-700">
                            ${commission_ledger.reduce((s, r) => s + (r.first_year_revenue || 0), 0).toLocaleString()}
                          </td>
                          <td className="pt-3" />
                          <td className="pt-3 text-right font-bold text-brand-navy text-base">
                            ${commission_summary.total_earned.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-4">Revenue and commission amounts are populated by SKMS when a referral is reviewed and invoiced. Contact your SKMS representative with questions.</p>
              </CardContent>
            </Card>

            {/* Commission Tiers */}
            {tiers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-5 h-5 text-brand-navy" />
                    Commission Tiers
                    {commission_summary.current_tier && (
                      <span className="ml-2 text-xs font-normal text-brand-navy px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(1,63,124,0.08)' }}>
                        Current rate: {(commission_summary.current_tier.rate * 100 % 1 === 0 ? (commission_summary.current_tier.rate * 100).toFixed(0) : (commission_summary.current_tier.rate * 100).toFixed(1))}%
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 mb-4">Tiers are based on first-year revenue placed annually. Your current rate applies to each new placement as you reach it.</p>
                  <div className="space-y-2">
                    {tiers.map((tier, i) => {
                      const isActive = commission_summary.current_tier?.min_revenue === tier.min_revenue;
                      return (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg border-2 ${isActive ? 'border-brand-navy bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                          <div className="flex items-center gap-3">
                            {isActive && <CheckCircle className="w-4 h-4 text-brand-navy" />}
                            <span className="font-medium text-gray-700">{tier.label || `Tier ${i + 1}`}</span>
                            <span className="text-sm text-gray-500">
                              ${tier.min_revenue.toLocaleString()}{tier.max_revenue ? ` – $${tier.max_revenue.toLocaleString()}` : '+'}
                            </span>
                          </div>
                          <span className={`font-bold text-lg ${isActive ? 'text-brand-navy' : 'text-gray-600'}`}>
                            {(tier.rate * 100 % 1 === 0 ? (tier.rate * 100).toFixed(0) : (tier.rate * 100).toFixed(1))}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {commission_summary.current_tier && (
                    <p className="mt-3 text-sm font-medium text-brand-navy">
                      Your current rate: {(commission_summary.current_tier.rate * 100 % 1 === 0 ? (commission_summary.current_tier.rate * 100).toFixed(0) : (commission_summary.current_tier.rate * 100).toFixed(1))}% · YTD Revenue: ${commission_summary.ytd_revenue.toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* What Earns Commission */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="w-5 h-5 text-brand-green" />
                  Commission Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#f9f8f5] border border-[#e6e1d8] rounded-lg p-4">
                    <p className="font-semibold text-brand-navy text-sm mb-2">What Earns Commission</p>
                    <p className="text-sm text-gray-600">Referred revenue received within <strong>12 months</strong> of a new client's first invoice: interactive workshops, 14-day team challenges, leadership EQ programs, mindful movement classes, and physical or digital wellness boxes. Expansion revenue within that Year-1 window counts toward your tier.</p>
                  </div>
                  <div className="bg-[#f9f8f5] border border-[#e6e1d8] rounded-lg p-4">
                    <p className="font-semibold text-brand-navy text-sm mb-2">A Few Things to Know</p>
                    <p className="text-sm text-gray-600">A placed client is a new client you introduce who signs an invoice. Clients already in our pipeline within the prior 90 days are excluded. Year 2+ renewals are not commissioned.</p>
                  </div>
                </div>

                {/* Every Partner Also Receives */}
                <div>
                  <p className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-brand-green" />
                    Every Partner Also Receives
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { title: 'Annual Workshop for Your Team', desc: 'A complimentary one-hour workshop for your office, virtual or in-person — so you can speak to the program with authority.' },
                      { title: 'Co-Branded Marketing Materials', desc: 'One-pagers, sample campaigns, and decks with your logo alongside SkillfulMeans — refreshed quarterly.' },
                      { title: 'Featured Podcast Guest Spot', desc: 'A recorded conversation on the SkillfulMeans podcast — full episode on YouTube, short clips on LinkedIn. Editing on us.' },
                      { title: 'Branded Apps & Tools', desc: 'Full access to our ROI Calculator, plus first access to the forthcoming Broker Toolkit & Partner Portal.' },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-brand-green mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Partnership Agreement */}
            {partner.agreement_file_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-brand-navy" />
                    Partnership Agreement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Broker Partnership Agreement</p>
                      {partner.agreement_signed_date && (
                        <p className="text-sm text-gray-500">Signed {format(new Date(partner.agreement_signed_date), 'MMMM d, yyyy')}</p>
                      )}
                    </div>
                    <a href={partner.agreement_file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        View
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </PortalShell>
    );
  }