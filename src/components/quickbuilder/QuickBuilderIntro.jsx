import React from 'react';
import { ExternalLink, LayoutDashboard, BarChart3, Mail, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgramJourney from '@/components/quickbuilder/ProgramJourney';

export const ROI_CALCULATOR_URL = 'https://skillfulmeans-roi-production.up.railway.app/';

const IMPACT_STATS = ['Absenteeism ↓', 'Presenteeism ↓', 'Turnover ↓', 'Medical claims ↓'];

const CAMPAIGN_INCLUDES = [
  {
    icon: LayoutDashboard,
    title: 'Client portal',
    desc: 'Your own portal with program timeline, session booking, and resources.',
    bgClass: 'bg-brand-navy/10',
    textClass: 'text-brand-navy',
  },
  {
    icon: BarChart3,
    title: 'Survey & ROI data',
    desc: 'Wellbeing and engagement measurement across your campaign, visible in your portal.',
    bgClass: 'bg-brand-green/10',
    textClass: 'text-brand-green',
  },
  {
    icon: Mail,
    title: 'Turn-key rollout',
    desc: 'Email templates and materials to get your workforce excited.',
    bgClass: 'bg-brand-plum/10',
    textClass: 'text-brand-plum',
  },
];

/** Preventative positioning band — shown at the top of step 1. */
export function PreventativeBand() {
  return (
    <div className="bg-brand-cream rounded-2xl border border-brand-navy/10 p-6 md:p-8 mb-6">
      <h2 className="text-2xl md:text-3xl font-bold text-brand-navy mb-3 leading-tight">
        Preventative mental fitness for your whole team.
      </h2>
      <p className="text-gray-700 leading-relaxed max-w-3xl">
        Think of SkillfulMeans as a preventative intervention — building mental fitness across your entire
        organization before stress becomes a crisis. Organizations use our campaigns to reduce absenteeism,
        presenteeism, turnover, and medical claims — while building a culture people want to stay in.
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {IMPACT_STATS.map(label => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 bg-white rounded-full border border-gray-200 px-3 py-1.5"
          >
            <TrendingDown className="w-3.5 h-3.5 text-brand-green" />
            <span className="text-xs font-semibold text-gray-700">{label}</span>
          </span>
        ))}
      </div>

      <Button asChild variant="outline" className="mt-5 gap-2 border-brand-plum/40 text-brand-plum hover:bg-brand-plum/5">
        <a href={ROI_CALCULATOR_URL} target="_blank" rel="noopener noreferrer">
          See projected impact for your organization
          <ExternalLink className="w-4 h-4" />
        </a>
      </Button>
    </div>
  );
}

/** Education section — shown below the builder steps so education follows action. */
export function QuickBuilderEducation() {
  return (
    <div className="space-y-8 mt-8">
      {/* Why campaigns work */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy mb-3">Why campaigns work</h2>
        <p className="text-gray-600 leading-relaxed">
          The most effective approaches integrate these skills across the organization — building a common language
          and a culture of psychological safety, mental fitness, emotional intelligence, and healthy productivity.
          That's why we recommend a campaign of at least a workshop + a 14-day challenge + wellness boxes.
        </p>

        <ProgramJourney />
      </div>

      {/* Every campaign includes */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Every campaign includes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CAMPAIGN_INCLUDES.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${item.bgClass}`}>
                  <Icon className={`w-4 h-4 ${item.textClass}`} />
                </div>
                <p className="font-semibold text-sm text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500 leading-snug mt-0.5">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}