import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Users, DollarSign, FileText, Plus, CheckCircle, Clock, TrendingUp, ExternalLink, AlertCircle, Gift, ChevronDown, BarChart3, ArrowLeft, BookOpen, ChevronRight, PlayCircle, Star } from 'lucide-react';
import ROIDashboard from '@/components/portal/ROIDashboard';
import BrokerFeedbackRollup from '@/components/portal/BrokerFeedbackRollup';

const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  converted_to_client: 'bg-green-100 text-green-700',
  purchased: 'bg-emerald-100 text-emerald-700',
  commission_paid: 'bg-purple-100 text-purple-700',
  not_eligible: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS = {
  submitted: 'Submitted',
  contacted: 'Contacted',
  converted_to_client: 'Converted to Client',
  purchased: 'Purchased',
  commission_paid: 'Commission Paid',
  not_eligible: 'Not Eligible',
};

export default function ReferralPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const portalId = urlParams.get('id');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ contact_name: '', contact_email: '', company_name: '', notes: '', proposal_id: '' });
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [selectedClientROI, setSelectedClientROI] = useState(null); // { id, company }
  const [activeTab, setActiveTab] = useState('dashboard'); // 'onboarding' | 'dashboard'
  const [commissionsOpen, setCommissionsOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  useEffect(() => {
    if (!portalId) {
      setError('No portal ID provided.');
      setLoading(false);
      return;
    }
    loadData();
  }, [portalId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getReferralPortalData', { portal_id: portalId });
      if (res.data && res.data.partner) {
        setData(res.data);
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
    setSubmitting(true);
    try {
      await base44.functions.invoke('createReferral', { portal_id: portalId, ...form });
      setSubmitted(true);
      setShowForm(false);
      setForm({ contact_name: '', contact_email: '', company_name: '', notes: '', proposal_id: '' });
      await loadData();
    } catch (err) {
      console.error('Failed to submit referral:', err);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Portal Not Found</h2>
          <p className="text-gray-500">This portal link is invalid or has expired. Please contact your SKMS Wellness representative.</p>
        </Card>
      </div>
    );
  }

  const { partner, referrals, commission_summary, client_companies = [], partner_proposals = [] } = data;
  const tiers = partner.commission_tiers || [];

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#013f7c] text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-blue-200 text-sm font-medium mb-1">Referral Partner Portal</p>
          <h1 className="text-2xl font-bold">{partner.name}</h1>
          {partner.company && <p className="text-blue-200 mt-1">{partner.company}</p>}
          {!partner.is_active && (
            <Badge className="mt-2 bg-red-500 text-white">Inactive Partnership</Badge>
          )}
        </div>
        {/* Tab Bar */}
        <div className="max-w-4xl mx-auto mt-5 flex gap-1">
          {[
            { key: 'onboarding', label: 'Start Here', icon: BookOpen },
            { key: 'dashboard', label: 'My Dashboard', icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                activeTab === key
                  ? 'bg-[#f4f0e9] text-[#013f7c]'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* ─── ONBOARDING TAB ─── */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          {/* Welcome */}
          <Card className="border-[#013f7c]/20">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Star className="w-8 h-8 text-[#013f7c]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#013f7c]">Welcome to Your Partner Portal, {partner.name.split(' ')[0]}!</h2>
                  <p className="text-gray-500 text-sm mt-1">Everything you need to track referrals, view client ROI, and grow your partnership with SKMS Wellness — all in one place.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Welcome Video Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PlayCircle className="w-5 h-5 text-[#264d44]" />
                Partner Welcome Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-[#013f7c]/5 border-2 border-dashed border-[#013f7c]/20 rounded-xl flex flex-col items-center justify-center text-center p-8 gap-3">
                <PlayCircle className="w-12 h-12 text-[#013f7c]/30" />
                <p className="text-gray-500 text-sm font-medium">Welcome video coming soon</p>
                <p className="text-gray-400 text-xs max-w-xs">A short walk-through of your portal, how to submit referrals, and how to read your clients' ROI data.</p>
              </div>
            </CardContent>
          </Card>

          {/* How to Use This Portal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="w-5 h-5 text-[#013f7c]" />
                How to Use This Portal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    step: '1',
                    title: 'Track Your Referrals',
                    desc: 'On the My Dashboard tab, see every referral you\'ve submitted and its current status — from initial contact all the way to commission paid.',
                  },
                  {
                    step: '2',
                    title: 'View Client ROI Data',
                    desc: 'In the "Book of Business" section, click any of your active clients to see NPS scores, stress reduction metrics, and session feedback from their employees.',
                  },
                  {
                    step: '3',
                    title: 'Generate Client Reports',
                    desc: 'Inside each client\'s ROI view, hit "Generate Report" to open a print-ready report you can share directly with the client\'s HR team.',
                  },
                  {
                    step: '4',
                    title: 'Submit New Referrals',
                    desc: 'Use the "Submit a Referral" section on the dashboard. A first name and company is enough to get started — we take it from there.',
                  },
                  {
                    step: '5',
                    title: 'Review Your Commission Earnings',
                    desc: 'Your live commission totals, YTD revenue placed, and pending balance are always visible at the top of your dashboard.',
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#013f7c] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{title}</p>
                      <p className="text-gray-500 text-sm mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SKMS Program Offerings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="w-5 h-5 text-[#264d44]" />
                What We Offer Your Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">These are the core programs your referred clients can access through SKMS Wellness:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'Interactive Workshops', desc: '60–90 minute live sessions on stress, resilience, sleep, and mental performance. Virtual or in-person.', color: 'bg-blue-50 text-blue-700' },
                  { name: '14-Day Team Challenges', desc: 'Structured micro-habit programs that drive daily engagement and measurable behavior change.', color: 'bg-green-50 text-green-700' },
                  { name: 'Leadership EQ Programs', desc: 'Emotional intelligence and pressure management training built for managers and executives.', color: 'bg-purple-50 text-purple-700' },
                  { name: 'Mindful Movement Classes', desc: 'Guided breathwork, yoga, and movement sessions that reduce absenteeism triggers.', color: 'bg-amber-50 text-amber-700' },
                  { name: 'Wellness Boxes', desc: 'Physical or digital curated boxes with tools and resources to reinforce program takeaways.', color: 'bg-rose-50 text-rose-700' },
                  { name: 'Annual Workshop for You', desc: 'Every partner gets a complimentary workshop for their own team — virtual or in-person.', color: 'bg-[#264d44]/10 text-[#264d44]' },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg border">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.color}`}>{item.name}</span>
                    <p className="text-xs text-gray-500 mt-2">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA to Dashboard */}
          <div className="text-center pb-2">
            <Button onClick={() => setActiveTab('dashboard')} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
              Go to My Dashboard <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── DASHBOARD TAB ─── */}
      {activeTab === 'dashboard' && (<>

        {/* Commission Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Referrals', value: referrals.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'YTD Revenue Placed', value: `$${(commission_summary.ytd_revenue || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Commission Earned', value: `$${(commission_summary.total_earned || 0).toLocaleString()}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Commission Pending', value: `$${(commission_summary.pending || 0).toLocaleString()}`, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Portfolio Feedback Roll-Up — always rendered */}
        <BrokerFeedbackRollup clientCompanies={client_companies} />

        {/* How It Works — collapsible */}
        <Card>
          <button
            onClick={() => setHowItWorksOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-left"
          >
            <span className="flex items-center gap-2 font-semibold text-base text-gray-800">
              <TrendingUp className="w-5 h-5 text-[#264d44]" />
              How the Program Works
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${howItWorksOpen ? 'rotate-180' : ''}`} />
          </button>
          {howItWorksOpen && <CardContent className="pt-0 space-y-5">
            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { num: '01', text: 'You flag a client opportunity — a quick email is fine' },
                { num: '02', text: 'We confirm pipeline status within 5 business days' },
                { num: '03', text: 'You introduce — we handle discovery, proposal, delivery' },
                { num: '04', text: 'Commission paid within 30 days of client invoice' },
                { num: '05', text: 'Quarterly partner statement with all placements' },
              ].map(s => (
                <div key={s.num} className="bg-[#f4f0e9] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[#013f7c] mb-1">{s.num}</p>
                  <p className="text-xs text-gray-600">{s.text}</p>
                </div>
              ))}
            </div>

            {/* What Earns Commission & Things to Know */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="font-semibold text-[#013f7c] text-sm mb-2">What Earns Commission</p>
                <p className="text-sm text-gray-600">Referred revenue received within <strong>12 months</strong> of a new client's first invoice: interactive workshops, 14-day team challenges, leadership EQ programs, mindful movement classes, and physical or digital wellness boxes. Expansion revenue within that Year-1 window counts toward your tier.</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="font-semibold text-amber-800 text-sm mb-2">A Few Things to Know</p>
                <p className="text-sm text-gray-600">A placed client is a new client you introduce who signs an invoice. Clients already in our pipeline within the prior 90 days are excluded. Year 2+ renewals are not commissioned.</p>
              </div>
            </div>

            {/* Every Partner Also Receives */}
            <div>
              <p className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#264d44]" />
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
                    <div className="w-2 h-2 rounded-full bg-[#264d44] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>}
        </Card>

        {/* Commission Tiers — collapsible */}
        {tiers.length > 0 && (
          <Card>
            <button
              onClick={() => setCommissionsOpen(o => !o)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <span className="flex items-center gap-2 font-semibold text-base text-gray-800">
                <TrendingUp className="w-5 h-5 text-[#013f7c]" />
                Commission Tiers
                {commission_summary.current_tier && (
                  <span className="ml-2 text-xs font-normal text-[#013f7c] bg-blue-50 px-2 py-0.5 rounded-full">
                    Current rate: {(commission_summary.current_tier.rate * 100 % 1 === 0 ? (commission_summary.current_tier.rate * 100).toFixed(0) : (commission_summary.current_tier.rate * 100).toFixed(1))}%
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${commissionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {commissionsOpen && (
              <CardContent className="pt-0">
                <p className="text-sm text-gray-500 mb-4">Tiers are based on first-year revenue placed annually. When you reach a new tier, all placements that year are upgraded retroactively.</p>
                <div className="space-y-2">
                  {tiers.map((tier, i) => {
                    const isActive = commission_summary.current_tier?.min_revenue === tier.min_revenue;
                    return (
                      <div key={i} className={`flex items-center justify-between p-3 rounded-lg border-2 ${isActive ? 'border-[#013f7c] bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          {isActive && <CheckCircle className="w-4 h-4 text-[#013f7c]" />}
                          <span className="font-medium text-gray-700">{tier.label || `Tier ${i + 1}`}</span>
                          <span className="text-sm text-gray-500">
                            ${tier.min_revenue.toLocaleString()}{tier.max_revenue ? ` – $${tier.max_revenue.toLocaleString()}` : '+'}
                          </span>
                        </div>
                        <span className={`font-bold text-lg ${isActive ? 'text-[#013f7c]' : 'text-gray-600'}`}>
                          {(tier.rate * 100 % 1 === 0 ? (tier.rate * 100).toFixed(0) : (tier.rate * 100).toFixed(1))}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                {commission_summary.current_tier && (
                  <p className="mt-3 text-sm font-medium text-[#013f7c]">
                    Your current rate: {(commission_summary.current_tier.rate * 100 % 1 === 0 ? (commission_summary.current_tier.rate * 100).toFixed(0) : (commission_summary.current_tier.rate * 100).toFixed(1))}% · YTD Revenue: ${commission_summary.ytd_revenue.toLocaleString()}
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Submit a Referral */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="w-5 h-5 text-[#264d44]" />
                Submit a Referral
              </CardTitle>
              {!showForm && (
                <Button onClick={() => { setShowForm(true); setSubmitted(false); }} className="bg-[#264d44] hover:bg-[#1e3a33] text-white">
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
                    <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Full name" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Contact Email</label>
                    <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="email@company.com" />
                  </div>
                  <div className="relative">
                    <label className="text-sm font-medium text-gray-700 block mb-1">Company Name</label>
                    <div className="flex gap-1">
                      <Input
                        value={form.company_name}
                        onChange={e => setForm(f => ({ ...f, company_name: e.target.value, proposal_id: '' }))}
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
                              onMouseDown={() => { setForm(f => ({ ...f, company_name: c.company, proposal_id: '' })); setCompanyDropdownOpen(false); }}
                            >
                              <span className="font-medium">{c.company}</span>
                              {c.name && c.name !== c.company && <span className="text-gray-400 ml-1 text-xs">— {c.name}</span>}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                  {/* Proposal selector — shown when a known company is selected */}
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
                          onChange={e => setForm(f => ({ ...f, proposal_id: e.target.value }))}
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
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any context about this referral..." rows={3} />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={submitting} className="bg-[#013f7c] hover:bg-[#012d5a] text-white">
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
              <Users className="w-5 h-5 text-[#013f7c]" />
              Your Referrals ({referrals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No referrals submitted yet. Use the button above to submit your first referral!</p>
            ) : (
              <div className="space-y-3">
                {referrals.map((r, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-gray-50 border gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">{r.contact_name}</p>
                      {r.company_name && <p className="text-sm text-gray-500">{r.company_name}</p>}
                      {r.contact_email && <p className="text-xs text-gray-400">{r.contact_email}</p>}
                      <p className="text-xs text-gray-400 mt-1">{format(new Date(r.referral_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2">
                      <Badge className={STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                      {r.commission_amount > 0 && (
                        <span className="text-sm font-semibold text-green-700">${r.commission_amount.toLocaleString()} commission</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agreement */}
        {partner.agreement_file_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-5 h-5 text-[#013f7c]" />
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

        {/* Book of Business — ROI Drill-Down */}
        {client_companies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-5 h-5 text-[#013f7c]" />
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
                      className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-[#013f7c]/20 transition-all group"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.company}</p>
                        {c.name && c.name !== c.company && <p className="text-xs text-gray-400">{c.name}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 group-hover:text-[#013f7c]">View ROI →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">SKMS Wellness · Referral Partner Portal</p>
      </>)}

      </div>
    </div>
  );
}