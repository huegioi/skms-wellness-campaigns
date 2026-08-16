import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FilePlus2, ScanText, SlidersHorizontal, FolderOpen } from 'lucide-react';
import { useClaimsBenchmarks } from '@/lib/useClaimsBenchmarks';
import { useRateCard } from '@/lib/useRateCard';
import ClaimsIntakeWizard from '@/components/claims/ClaimsIntakeWizard';
import ClaimsProfileView from '@/components/claims/ClaimsProfileView';
import ClaimsBenchmarksPanel from '@/components/claims/ClaimsBenchmarksPanel';

/**
 * Claims Insight (build plan §7.2) — a broker/HR contact's aggregate claims
 * report goes in; a Mental Health Risk Profile, hidden-cost estimate,
 * recommended campaign, and clinical referral pathway come out.
 *
 * Aggregate, de-identified fields only. No PHI can enter: numbers and
 * picklists, never names, member IDs, or claim-line files.
 */

const BAND_DOT = { High: 'bg-red-500', Elevated: 'bg-amber-500', Low: 'bg-emerald-500' };

export default function ClaimsInsight() {
  useClaimsBenchmarks();  // saved benchmark overrides before anything scores
  useRateCard();          // campaign pricing reads the live rate card
  const qc = useQueryClient();

  const [tab, setTab] = useState('profiles');      // profiles | new | benchmarks
  const [selected, setSelected] = useState(null);  // profile being viewed
  const [editing, setEditing] = useState(null);    // profile being re-scored

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['claimsProfiles'],
    queryFn: () => base44.entities.ClaimsProfile.list('-scored_at', 100),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['claimsProfiles'] });

  const openProfile = (p) => { setSelected(p); setEditing(null); };

  const handleScored = (profile) => {
    refresh();
    setEditing(null);
    setTab('profiles');
    setSelected(profile);
  };

  const startEdit = (profile) => {
    setEditing(profile);
    setSelected(null);
    setTab('new');
  };

  const tabs = [
    { key: 'profiles', label: 'Profiles', icon: FolderOpen },
    { key: 'new', label: editing ? 'Re-score' : 'New analysis', icon: FilePlus2 },
    { key: 'benchmarks', label: 'Benchmarks', icon: SlidersHorizontal },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ScanText className="w-6 h-6 text-[#6b4a35]" /> Claims Insight
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Read a renewal claims report → risk profile, hidden cost, recommended campaign, and the
              clinical referral pathway. Aggregate fields only — nothing member-level ever enters.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); if (t.key !== 'profiles') setSelected(null); if (t.key !== 'new') setEditing(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tab === t.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'profiles' && selected && (
          <ClaimsProfileView
            profile={selected}
            onBack={() => setSelected(null)}
            onEdit={startEdit}
          />
        )}

        {tab === 'profiles' && !selected && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {isLoading ? (
              <p className="p-6 text-gray-400">Loading profiles…</p>
            ) : profiles.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-gray-500 mb-3">No claims profiles yet.</p>
                <Button onClick={() => setTab('new')} className="bg-gray-900 hover:bg-gray-700">
                  <FilePlus2 className="w-4 h-4 mr-1" /> Run the first analysis
                </Button>
                <p className="text-xs text-gray-400 mt-3">
                  Tip: enter the worksheet's 850-person example as a demo to see the full output.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-3">Company</th>
                    <th className="px-3 py-3">Year</th>
                    <th className="px-3 py-3">Subscores</th>
                    <th className="px-3 py-3">Confidence</th>
                    <th className="px-3 py-3">Hidden cost</th>
                    <th className="px-3 py-3">Scored</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(p => {
                    const subs = p.results?.subscores || {};
                    const hc = p.results?.hiddenCost;
                    return (
                      <tr key={p.id} onClick={() => openProfile(p)} className="border-t border-gray-50 hover:bg-[#faf8f4] cursor-pointer">
                        <td className="px-5 py-3 font-semibold text-gray-800">
                          {p.company_name}
                          {p.is_demo && <span className="ml-2 text-[10px] font-bold text-red-500 border border-red-200 rounded px-1 py-0.5">DEMO</span>}
                          {p.client_id && <span className="ml-2 text-[10px] font-bold text-emerald-600 border border-emerald-200 rounded px-1 py-0.5">CLIENT</span>}
                        </td>
                        <td className="px-3 py-3 text-gray-500">{p.report_year || '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            {Object.values(subs).map(s => (
                              <span key={s.key} title={`${s.label}: ${s.score ?? '—'} ${s.band || ''}`}
                                className="flex items-center gap-1 text-xs text-gray-600">
                                <span className={`w-2 h-2 rounded-full ${s.band ? BAND_DOT[s.band] : 'bg-gray-200'}`} />
                                {s.score ?? '—'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500">{p.confidence || '—'}</td>
                        <td className="px-3 py-3 text-gray-500">
                          {hc ? `$${Math.round(hc.low / 1000)}k–$${Math.round(hc.high / 1000)}k` : '—'}
                        </td>
                        <td className="px-3 py-3 text-gray-400">
                          {p.scored_at ? new Date(p.scored_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'new' && (
          <ClaimsIntakeWizard
            existingProfile={editing}
            onScored={handleScored}
            onCancel={() => { setEditing(null); setTab('profiles'); }}
          />
        )}

        {tab === 'benchmarks' && <ClaimsBenchmarksPanel />}
      </div>
    </div>
  );
}
