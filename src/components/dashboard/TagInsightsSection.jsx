import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TagChips } from '@/components/ui/TagChips';
import TagFilter from '@/components/ui/TagFilter';
import { useTags } from '@/hooks/useTags';
import { Tag, Handshake, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';

const MIN_LEAD_VOLUME = 3;

export default function TagInsightsSection() {
  const [selectedTags, setSelectedTags] = useState([]);
  const { tagMap } = useTags();

  const { data: rawLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });
  const { data: rawClients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });
  const { data: rawPartners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.list(),
  });
  const { data: rawReferrals = [] } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 200),
  });

  const leads = useMemo(() => rawLeads.filter(l => !l.is_demo), [rawLeads]);
  const clients = useMemo(() => rawClients.filter(c => !c.is_demo), [rawClients]);
  const partners = useMemo(() => rawPartners.filter(p => !p.is_demo), [rawPartners]);
  const referrals = useMemo(() => rawReferrals.filter(r => !r.is_demo), [rawReferrals]);

  // Tag overview: counts split by entity type
  const overview = useMemo(() => {
    const map = {};
    const inc = (tag, key) => {
      if (!map[tag]) map[tag] = { name: tag, leads: 0, clients: 0, partners: 0 };
      map[tag][key]++;
    };
    leads.forEach(l => (l.tags || []).forEach(t => inc(t, 'leads')));
    clients.forEach(c => (c.tags || []).forEach(t => inc(t, 'clients')));
    partners.forEach(p => (p.tags || []).forEach(t => inc(t, 'partners')));
    return Object.values(map).map(o => ({
      ...o,
      total: o.leads + o.clients + o.partners,
      color: tagMap[o.name.toLowerCase()]?.color || '#94a3b8',
    })).sort((a, b) => b.total - a.total);
  }, [leads, clients, partners, tagMap]);

  // Conversion signal: share of tagged leads that converted
  const conversion = useMemo(() => {
    return overview
      .filter(o => o.leads >= MIN_LEAD_VOLUME)
      .map(o => {
        const taggedLeads = leads.filter(l => (l.tags || []).includes(o.name));
        const converted = taggedLeads.filter(l => l.status === 'converted' || l.status === 'current_client').length;
        return { ...o, converted, rate: o.leads > 0 ? Math.round((converted / o.leads) * 100) : 0 };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [overview, leads]);

  // Partner lens
  const activePartners = useMemo(() => partners.filter(p => p.is_active), [partners]);

  const partnerTagCounts = useMemo(() => {
    const map = {};
    activePartners.forEach(p => (p.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).map(([name, count]) => ({
      name, count, color: tagMap[name.toLowerCase()]?.color || '#94a3b8',
    })).sort((a, b) => b.count - a.count);
  }, [activePartners, tagMap]);

  const sharedTagPairs = useMemo(() => {
    return referrals
      .filter(r => r.referral_partner_id && r.referred_client_id)
      .map(r => {
        const partner = partners.find(p => p.id === r.referral_partner_id);
        const client = clients.find(c => c.id === r.referred_client_id);
        if (!partner || !client) return null;
        const partnerTags = new Set(partner.tags || []);
        const shared = (client.tags || []).filter(t => partnerTags.has(t));
        if (shared.length === 0) return null;
        return { partnerName: partner.name, clientName: client.name, sharedTags: shared };
      })
      .filter(Boolean);
  }, [referrals, partners, clients]);

  // Recent tagging activity
  const recentActivity = useMemo(() => {
    const entries = [];
    leads.forEach(l => (l.tags || []).forEach(t => entries.push({ name: l.name, type: 'Lead', tag: t, when: l.updated_date })));
    clients.forEach(c => (c.tags || []).forEach(t => entries.push({ name: c.name, type: 'Client', tag: t, when: c.updated_date })));
    partners.forEach(p => (p.tags || []).forEach(t => entries.push({ name: p.name, type: 'Partner', tag: t, when: p.updated_date })));
    return entries
      .filter(e => e.when)
      .sort((a, b) => new Date(b.when) - new Date(a.when));
  }, [leads, clients, partners]);

  // Apply tag filter
  const visibleOverview = selectedTags.length ? overview.filter(o => selectedTags.includes(o.name)) : overview;
  const visibleConversion = selectedTags.length ? conversion.filter(c => selectedTags.includes(c.name)) : conversion;
  const visiblePartnerTags = selectedTags.length ? partnerTagCounts.filter(t => selectedTags.includes(t.name)) : partnerTagCounts;
  const visibleRecent = (selectedTags.length ? recentActivity.filter(e => selectedTags.includes(e.tag)) : recentActivity).slice(0, 10);

  const isLoading = leadsLoading || clientsLoading || partnersLoading;
  const hasAnyTags = overview.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#264d44] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold" style={{ color: '#264d44' }}>Tag Insights</h2>
        <TagFilter selected={selectedTags} onChange={setSelectedTags} />
      </div>

      {!hasAnyTags ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No tags applied yet</p>
            <p className="text-gray-400 text-sm mt-1">Tag leads, clients, or partners to see analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tag overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#264d44' }}>
                <Tag className="w-5 h-5" />
                Tag Overview
              </CardTitle>
              <p className="text-sm text-gray-500">Usage across leads, clients, and partners — sorted by total.</p>
            </CardHeader>
            <CardContent>
              {visibleOverview.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">No tags match the current filter.</p>
              ) : (
                <div className="space-y-2">
                  {visibleOverview.map(tag => (
                    <div key={tag.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span
                        className="rounded-full border font-medium text-xs px-2 py-1 shrink-0 min-w-[7rem]"
                        style={{ backgroundColor: `${tag.color}15`, borderColor: tag.color, color: tag.color }}
                      >
                        {tag.name}
                      </span>
                      <div className="flex items-center gap-4 text-sm flex-1">
                        <span className="text-gray-600">Leads: <strong className="text-gray-900">{tag.leads}</strong></span>
                        <span className="text-gray-600">Clients: <strong className="text-gray-900">{tag.clients}</strong></span>
                        <span className="text-gray-600">Partners: <strong className="text-gray-900">{tag.partners}</strong></span>
                      </div>
                      <span className="text-sm font-bold text-[#264d44] shrink-0">{tag.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion signal */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#264d44' }}>
                <TrendingUp className="w-5 h-5" />
                Conversion Signal
              </CardTitle>
              <p className="text-sm text-gray-500">Share of tagged leads that converted (≥ {MIN_LEAD_VOLUME} leads).</p>
            </CardHeader>
            <CardContent>
              {visibleConversion.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">
                  {selectedTags.length ? 'No conversion data for the selected tags.' : 'Not enough tagged leads to measure conversion yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {visibleConversion.map(tag => (
                    <div key={tag.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="rounded-full border font-medium text-xs px-2 py-0.5"
                          style={{ backgroundColor: `${tag.color}15`, borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                        <span className="text-sm text-gray-600">
                          <strong className="text-gray-900">{tag.converted}</strong> / {tag.leads} leads · <strong style={{ color: '#264d44' }}>{tag.rate}%</strong>
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${tag.rate}%`, backgroundColor: tag.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Partner lens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#264d44' }}>
                  <Handshake className="w-5 h-5" />
                  Tags on Active Partners
                </CardTitle>
                <p className="text-sm text-gray-500">Most common tags among active referral partners.</p>
              </CardHeader>
              <CardContent>
                {activePartners.length === 0 ? (
                  <p className="text-gray-400 text-sm py-6 text-center">No active referral partners.</p>
                ) : visiblePartnerTags.length === 0 ? (
                  <p className="text-gray-400 text-sm py-6 text-center">
                    {selectedTags.length ? 'No active partners carry the selected tags.' : 'No tags on active partners yet.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visiblePartnerTags.slice(0, 10).map(tag => (
                      <div key={tag.name} className="flex items-center gap-3">
                        <span
                          className="rounded-full border font-medium text-xs px-2 py-0.5 shrink-0"
                          style={{ backgroundColor: `${tag.color}15`, borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(tag.count / activePartners.length) * 100}%`, backgroundColor: tag.color }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-8 text-right shrink-0">{tag.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#264d44' }}>
                  <Handshake className="w-5 h-5" />
                  Shared Partner ↔ Client Tags
                </CardTitle>
                <p className="text-sm text-gray-500">Tags shared between a partner and the clients they referred.</p>
              </CardHeader>
              <CardContent>
                {sharedTagPairs.length === 0 ? (
                  <p className="text-gray-400 text-sm py-6 text-center">No shared tags between partners and referred clients.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {sharedTagPairs.slice(0, 12).map((pair, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-700 mb-1">
                          <strong>{pair.partnerName}</strong> → {pair.clientName}
                        </p>
                        <TagChips tags={pair.sharedTags} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent tagging activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#264d44' }}>
                <Clock className="w-5 h-5" />
                Recent Tagging Activity
              </CardTitle>
              <p className="text-sm text-gray-500">Most recently updated tagged records.</p>
            </CardHeader>
            <CardContent>
              {visibleRecent.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">
                  {selectedTags.length ? 'No recent activity for the selected tags.' : 'No recent tag activity yet.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleRecent.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{entry.type}</span>
                        <span className="text-sm font-medium text-gray-800 truncate">{entry.name}</span>
                      </div>
                      <TagChips tags={[entry.tag]} />
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                        {format(new Date(entry.when), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}