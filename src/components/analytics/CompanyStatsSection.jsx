import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, HeartPulse, Handshake, DollarSign, Users, Repeat, UserPlus, Share2, AlertTriangle, BarChart3 } from 'lucide-react';

/**
 * Company Stats — top-of-funnel "state of the book" metrics.
 *
 * Definitions (agreed 2026-08):
 * - Active client  = a real Client (not demo / internal / assessment-lead) with at least
 *   one in-scope invoice issued within the past 24 months. Invoices that are demo,
 *   out_of_scope (other business in the shared QuickBooks file), or cancelled don't count.
 * - Lives covered  = sum of employee headcount across active clients. Uses the exact
 *   employee_count when present, otherwise the midpoint of the company_size band, so it
 *   is labeled an estimate and the coverage of exact counts is shown.
 * - Active partner = ReferralPartner with partner_status "Active Partner", is_active,
 *   excluding demo/internal records.
 */

const TWO_YEARS_DAYS = 730;
const ONE_YEAR_DAYS = 365;

// Midpoints for company_size bands, used only when employee_count is missing
const SIZE_BAND_ESTIMATE = {
  '1-50': 25,
  '51-200': 125,
  '201-500': 350,
  '501-1000': 750,
  '1001-5000': 3000,
  '5000+': 5000,
};

function daysAgo(dateStr, now) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d)) return Infinity;
  return (now - d) / (1000 * 60 * 60 * 24);
}

function fmtNum(n) {
  return (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtMoney(n) {
  return '$' + (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-lg">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${iconBg} shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function CompanyStatsSection() {
  const { data: rawClients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
    staleTime: 60_000,
  });

  const { data: rawInvoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-issue_date'),
    staleTime: 60_000,
  });

  const { data: rawPartners = [] } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.list(),
    staleTime: 60_000,
  });

  const { data: rawPartnerLeads = [] } = useQuery({
    queryKey: ['partnerLeadCount'],
    queryFn: () => base44.entities.Lead.filter(
      { lead_type: 'broker_lead', is_archived: { $ne: true } },
      '-created_date', 500, 0, ['id', 'is_demo']
    ),
    staleTime: 60_000,
  });

  const stats = React.useMemo(() => {
    const now = new Date();

    // Real clients only
    const clients = rawClients.filter(c => !c.is_demo && !c.is_internal && !c.is_assessment_lead);

    // In-scope purchases only
    const invoices = rawInvoices.filter(inv =>
      !inv.is_demo && !inv.out_of_scope && inv.status !== 'cancelled' && inv.issue_date
    );

    // Most recent purchase per client
    const lastPurchase = {}; // client_id -> days since most recent invoice
    const firstPurchase = {}; // client_id -> days since oldest invoice
    const revenueT12M = {}; // client_id -> revenue in trailing 12 months
    let totalRevenueT12M = 0;
    let totalRevenue24M = 0;

    invoices.forEach(inv => {
      const age = daysAgo(inv.issue_date, now);
      const cid = inv.client_id;
      if (cid) {
        if (lastPurchase[cid] === undefined || age < lastPurchase[cid]) lastPurchase[cid] = age;
        if (firstPurchase[cid] === undefined || age > firstPurchase[cid]) firstPurchase[cid] = age;
        if (age <= ONE_YEAR_DAYS) revenueT12M[cid] = (revenueT12M[cid] || 0) + (inv.total_amount || 0);
      }
      if (age <= ONE_YEAR_DAYS) totalRevenueT12M += inv.total_amount || 0;
      if (age <= TWO_YEARS_DAYS) totalRevenue24M += inv.total_amount || 0;
    });

    // Active = purchased anything within the past 2 years
    const activeClients = clients.filter(c => (lastPurchase[c.id] ?? Infinity) <= TWO_YEARS_DAYS);

    // Lives covered across active clients
    let lives = 0;
    let exactCount = 0;
    let estimatedCount = 0;
    let unknownCount = 0;
    activeClients.forEach(c => {
      if (c.employee_count > 0) {
        lives += c.employee_count;
        exactCount++;
      } else if (SIZE_BAND_ESTIMATE[c.company_size]) {
        lives += SIZE_BAND_ESTIMATE[c.company_size];
        estimatedCount++;
      } else {
        unknownCount++;
      }
    });

    // Partners
    const partners = rawPartners.filter(p => !p.is_demo && !p.is_internal);
    const activePartners = partners.filter(p => p.is_active !== false && p.partner_status === 'Active Partner');
    const prospectPartners = partners.filter(p => p.partner_status === 'Prospect');
    const partnerLeadCount = rawPartnerLeads.filter(l => !l.is_demo).length;

    // Benefits-book metrics
    const avgGroupSize = activeClients.length > 0 ? lives / activeClients.length : 0;
    const revenuePerLife = lives > 0 ? totalRevenueT12M / lives : 0;
    const avgRevenuePerClient = activeClients.length > 0 ? totalRevenueT12M / activeClients.length : 0;

    // Retention: of clients who purchased 12–24 months ago, how many purchased again in the last 12 months
    const priorWindowClients = clients.filter(c => {
      const days = Object.entries(lastPurchase).length ? null : null;
      return invoices.some(inv => inv.client_id === c.id && daysAgo(inv.issue_date, now) > ONE_YEAR_DAYS && daysAgo(inv.issue_date, now) <= TWO_YEARS_DAYS);
    });
    const retained = priorWindowClients.filter(c => (lastPurchase[c.id] ?? Infinity) <= ONE_YEAR_DAYS);
    const retentionRate = priorWindowClients.length > 0 ? (retained.length / priorWindowClients.length) * 100 : null;

    // New clients: first-ever purchase within the last 12 months
    const newClients = clients.filter(c => (firstPurchase[c.id] ?? Infinity) <= ONE_YEAR_DAYS);

    // Partner/broker-sourced share of active clients
    const partnerSourced = activeClients.filter(c =>
      (c.referral_partner_id && c.referral_partner_id !== '') ||
      (c.brokers && c.brokers.length > 0) ||
      (c.broker_name && c.broker_name.trim() !== '')
    );
    const partnerSourcedPct = activeClients.length > 0 ? (partnerSourced.length / activeClients.length) * 100 : 0;

    // At-risk: still "active" on the 2-year definition but nothing in the last 12 months
    const atRisk = activeClients.filter(c => (lastPurchase[c.id] ?? Infinity) > ONE_YEAR_DAYS);

    return {
      activeClientCount: activeClients.length,
      totalClientCount: clients.length,
      lives, exactCount, estimatedCount, unknownCount,
      activePartnerCount: activePartners.length,
      prospectPartnerCount: prospectPartners.length,
      partnerLeadCount,
      totalRevenueT12M, totalRevenue24M,
      avgGroupSize, revenuePerLife, avgRevenuePerClient,
      retentionRate, retainedCount: retained.length, priorWindowCount: priorWindowClients.length,
      newClientCount: newClients.length,
      partnerSourcedPct, partnerSourcedCount: partnerSourced.length,
      atRiskCount: atRisk.length,
    };
  }, [rawClients, rawInvoices, rawPartners, rawPartnerLeads]);

  const loading = clientsLoading || invoicesLoading;

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold" style={{ color: '#264d44' }}>Company Stats</h2>
        <p className="text-xs text-gray-500">
          Active = purchased within the past 2 years · demo &amp; internal records excluded
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-8 shadow-lg text-center text-gray-400 text-sm">
          Loading company stats…
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              icon={Building2} iconBg="bg-blue-100" iconColor="text-blue-600"
              label="Active Clients"
              value={fmtNum(stats.activeClientCount)}
              sub={`of ${fmtNum(stats.totalClientCount)} total clients`}
            />
            <StatCard
              icon={HeartPulse} iconBg="bg-rose-100" iconColor="text-rose-600"
              label="Lives Covered (est.)"
              value={fmtNum(stats.lives)}
              sub={
                stats.estimatedCount > 0 || stats.unknownCount > 0
                  ? `${stats.exactCount} exact · ${stats.estimatedCount} estimated${stats.unknownCount > 0 ? ` · ${stats.unknownCount} unknown` : ''}`
                  : 'exact headcounts'
              }
            />
            <StatCard
              icon={Handshake} iconBg="bg-emerald-100" iconColor="text-emerald-600"
              label="Active Partners"
              value={fmtNum(stats.activePartnerCount)}
              sub={`${fmtNum(stats.prospectPartnerCount)} prospects · ${fmtNum(stats.partnerLeadCount)} partner leads in pipeline`}
            />
            <StatCard
              icon={DollarSign} iconBg="bg-purple-100" iconColor="text-purple-600"
              label="Revenue (trailing 12 mo)"
              value={fmtMoney(stats.totalRevenueT12M)}
              sub={`${fmtMoney(stats.totalRevenue24M)} over 2 years`}
            />
          </div>

          {/* Benefits-book metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Users} iconBg="bg-sky-100" iconColor="text-sky-600"
              label="Avg. Group Size"
              value={fmtNum(stats.avgGroupSize)}
              sub="lives per active client"
            />
            <StatCard
              icon={BarChart3} iconBg="bg-indigo-100" iconColor="text-indigo-600"
              label="Revenue per Life"
              value={'$' + (stats.revenuePerLife ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              sub="trailing 12 mo ÷ lives covered"
            />
            <StatCard
              icon={Repeat} iconBg="bg-green-100" iconColor="text-green-600"
              label="Client Retention"
              value={stats.retentionRate === null ? '—' : stats.retentionRate.toFixed(0) + '%'}
              sub={stats.retentionRate === null
                ? 'no clients in prior-year window'
                : `${stats.retainedCount} of ${stats.priorWindowCount} repurchased within 12 mo`}
            />
            <StatCard
              icon={UserPlus} iconBg="bg-amber-100" iconColor="text-amber-600"
              label="New Clients (12 mo)"
              value={fmtNum(stats.newClientCount)}
              sub="first purchase in the last year"
            />
            <StatCard
              icon={Share2} iconBg="bg-teal-100" iconColor="text-teal-600"
              label="Partner-Sourced"
              value={stats.partnerSourcedPct.toFixed(0) + '%'}
              sub={`${stats.partnerSourcedCount} active clients via partners/brokers`}
            />
            <StatCard
              icon={DollarSign} iconBg="bg-fuchsia-100" iconColor="text-fuchsia-600"
              label="Avg. Revenue / Client"
              value={fmtMoney(stats.avgRevenuePerClient)}
              sub="trailing 12 mo, active clients"
            />
            <StatCard
              icon={AlertTriangle} iconBg="bg-orange-100" iconColor="text-orange-600"
              label="At-Risk Clients"
              value={fmtNum(stats.atRiskCount)}
              sub="active, but nothing purchased in 12 mo"
            />
            <StatCard
              icon={HeartPulse} iconBg="bg-slate-100" iconColor="text-slate-600"
              label="Headcount Data"
              value={stats.activeClientCount > 0
                ? Math.round((stats.exactCount / stats.activeClientCount) * 100) + '%'
                : '—'}
              sub="active clients with exact employee counts"
            />
          </div>
        </>
      )}
    </div>
  );
}
