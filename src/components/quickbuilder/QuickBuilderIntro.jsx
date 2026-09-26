import React from 'react';
import { LayoutDashboard, BarChart3, Mail, TrendingDown } from 'lucide-react';
import ProgramJourney from '@/components/quickbuilder/ProgramJourney';
import { ROI_CALCULATOR_URL } from '@/lib/rateCard';

// Re-exported for older importers. The URL itself is defined once, in the
// rate card — it was duplicated here and would have drifted.
export { ROI_CALCULATOR_URL };

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
    <div className="bg-brand-cream rounded-2xl border border-brand-navy/10 p-5 sm:p-6 md:p-8 mb-5 sm:mb-6">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-navy mb-2 sm:mb-3 leading-tight">
        Mental Fitness for your whole team.
      </h2>
      <p className="text-[15px] sm:text-base text-gray-700 leading-relaxed max-w-3xl">
        Add SkillfulMeans as a preventative intervention across your entire organization before stress, miscommunication and culture become a crisis.
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

    </div>
  );
}

/** Education section — shown below the builder steps so education follows action. */
/**
 * The two supporting sections, split so each step can show only what earns its
 * place there. Step 1 is the form alone; step 2 is choosing a tier, where the
 * essay would push the cards down the page.
 */
export function WhyCampaignsWork() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mt-8">
      <h2 className="text-xl md:text-2xl font-bold text-brand-navy mb-3">Why campaigns work</h2>
      <p className="text-gray-600 leading-relaxed">
        The most effective approaches integrate these skills across the organization — building a common language
        and a culture of psychological safety, mental fitness, emotional intelligence, and healthy productivity.
        That's why we recommend a campaign of at least a workshop + a 14-day challenge + wellness boxes.
      </p>

      <ProgramJourney />
    </div>
  );
}

export function EveryCampaignIncludes() {
  return (
    <div className="mt-6 sm:mt-8">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Every campaign includes</h3>
      {/* Phone: one card with three icon-left rows (was three stacked cards,
          about a screen of scrolling). From sm up: the original three cards. */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100
                      sm:bg-transparent sm:border-0 sm:shadow-none sm:divide-y-0 sm:rounded-none
                      grid grid-cols-1 sm:grid-cols-3 sm:gap-3">
        {CAMPAIGN_INCLUDES.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-start gap-3 p-3.5 sm:block sm:bg-white sm:rounded-xl sm:border sm:border-gray-100 sm:shadow-sm sm:p-4"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 sm:mb-2 ${item.bgClass}`}>
                <Icon className={`w-4 h-4 ${item.textClass}`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500 leading-snug mt-0.5">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Kept for any older importer — renders both, in the original order. */
export function QuickBuilderEducation() {
  return (
    <>
      <WhyCampaignsWork />
      <EveryCampaignIncludes />
    </>
  );
}