import React from 'react';
import { TrendingUp, Users, Target, Gift, Award } from 'lucide-react';

const CAMPAIGNS = {
  stress: {
    workshop: 'Mindfulness for Stress Reduction',
    challenge: 'Calm & Confident Mind — 14-day challenge',
    incentive: 'Wellness Boxes',
    leadership: null,
  },
  connection: {
    workshop: 'Creating Connections',
    challenge: 'Creating Connections — community challenge',
    incentive: 'Wellness Boxes',
    leadership: null,
  },
  engagement: {
    workshop: 'Embracing a Growth Mindset',
    challenge: 'True North challenge',
    incentive: 'Wellness Boxes',
    leadership: 'Leadership EQ Series',
  },
  wellbeing: {
    workshop: 'Fostering Mental Well-Being',
    challenge: 'Deepening Emotional Resilience challenge',
    incentive: 'Wellness Boxes',
    leadership: null,
  },
};

function CampaignCard({ domain, share, rank }) {
  const campaign = CAMPAIGNS[domain.key];
  if (!campaign) return null;
  const isFirst = rank === 0;
  const items = [
    { icon: Users, label: 'Workshop', value: campaign.workshop },
    { icon: Target, label: 'Challenge', value: campaign.challenge },
    { icon: Gift, label: 'Incentive', value: campaign.incentive },
  ];
  if (campaign.leadership) {
    items.push({ icon: Award, label: 'Leadership', value: campaign.leadership });
  }
  return (
    <div className={`rounded-xl p-4 ${isFirst ? 'bg-[#0f766e]/5 border border-[#0f766e]/20' : 'bg-stone-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className={`w-4 h-4 ${isFirst ? 'text-[#0f766e]' : 'text-stone-400'}`} />
        <p className="text-sm font-bold text-[#4a2040]">~{share}% of your opportunity sits in {domain.label}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-6">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <item.icon className="w-3 h-3 text-[#0f766e] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wide">{item.label}</p>
              <p className="text-xs text-stone-600 font-medium leading-tight">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DomainOpportunityCards({ domains, services }) {
  const activeDomains = domains.filter(d => d.share > 0);
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-1">Where your opportunity is concentrated</h2>
      <p className="text-xs text-stone-500 mb-4 leading-relaxed">
        Based on your team's domain scores, this is where the savings are concentrated — with the SkillfulMeans programming that targets each domain.
      </p>
      <div className="space-y-3">
        {activeDomains.map((d, i) => (
          <CampaignCard key={d.key} domain={d} share={d.share} rank={i} />
        ))}
      </div>
    </div>
  );
}