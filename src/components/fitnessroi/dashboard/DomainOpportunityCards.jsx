import React from 'react';
import { MFS_SERVICE_MAPPING } from '@/lib/mfsServiceMapping';
import { TrendingUp } from 'lucide-react';

const DOMAIN_TO_INSTRUMENT = { stress: 'pss4', wellbeing: 'who5', engagement: 'uwes3', connection: 'ucla3' };

function servicesForDomain(domainKey, allServices) {
  const instKey = DOMAIN_TO_INSTRUMENT[domainKey];
  const mapping = MFS_SERVICE_MAPPING[instKey];
  if (!mapping || !allServices || allServices.length === 0) return [];
  const matches = new Set();
  if (mapping.fullCampaign) {
    for (const cat of ['workshop', 'challenge', 'leadership', 'class']) {
      const svc = allServices.find(s => s.category === cat && s.is_active !== false);
      if (svc) matches.add(svc.name);
    }
  } else {
    const kwMap = [
      { cat: 'workshop', kws: mapping.workshopKeywords },
      { cat: 'challenge', kws: mapping.challengeKeywords },
      { cat: 'leadership', kws: mapping.leadershipKeywords },
    ];
    for (const { cat, kws } of kwMap) {
      if (!kws) continue;
      for (const svc of allServices) {
        if (svc.category !== cat || svc.is_active === false) continue;
        const name = (svc.name || '').toLowerCase();
        if (kws.some(kw => name.includes(kw))) matches.add(svc.name);
      }
    }
  }
  return Array.from(matches).slice(0, 3);
}

export default function DomainOpportunityCards({ domains, services }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-1">Where your opportunity is concentrated</h2>
      <p className="text-xs text-stone-500 mb-4 leading-relaxed">
        Based on your team's domain scores, this is where the savings are concentrated — shown as approximate shares, ranked from largest to smallest, with the SkillfulMeans programming that targets each domain.
      </p>
      <div className="space-y-3">
        {domains.map((d, i) => {
          const suggestions = servicesForDomain(d.key, services);
          return (
            <div key={d.key} className={`rounded-xl p-4 ${i === 0 ? 'bg-[#0f766e]/5 border border-[#0f766e]/20' : 'bg-stone-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className={`w-4 h-4 ${i === 0 ? 'text-[#0f766e]' : 'text-stone-400'}`} />
                <p className="text-sm font-bold text-[#4a2040]">~{d.share}% of your opportunity sits in {d.label}</p>
              </div>
              {suggestions.length > 0 && (
                <p className="text-xs text-stone-500 ml-6">Suggested programming: {suggestions.join(' · ')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}