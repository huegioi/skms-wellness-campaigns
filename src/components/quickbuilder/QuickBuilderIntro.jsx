import React from 'react';
import { ExternalLink, LayoutDashboard, BarChart3, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgramJourney from '@/components/quickbuilder/ProgramJourney';

export const ROI_CALCULATOR_URL = 'https://skillfulmeans-roi-production.up.railway.app/';

const CAMPAIGN_INCLUDES = [
  {
    icon: LayoutDashboard,
    title: 'Client portal',
    desc: 'Your own portal with program timeline, session booking, and resources.',
    color: '#013f7c',
  },
  {
    icon: BarChart3,
    title: 'Survey & ROI data',
    desc: 'Wellbeing and engagement measurement across your campaign, visible in your portal.',
    color: '#264d44',
  },
  {
    icon: Mail,
    title: 'Turn-key rollout',
    desc: 'Email templates and materials to get your workforce excited.',
    color: '#770142',
  },
];

export default function QuickBuilderIntro() {
  return (
    <div className="space-y-8 mb-10">
      {/* Why campaigns work */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold text-brand-navy mb-3">Why campaigns work</h2>
        <p className="text-gray-600 leading-relaxed">
          The most effective approaches integrate these skills across the organization — building a common language
          and a culture of psychological safety, mental fitness, emotional intelligence, and healthy productivity.
          That's why we recommend a campaign of at least a workshop + a 14-day challenge + wellness boxes.
        </p>

        {/* Four-step journey — imagery pillars */}
        <ProgramJourney />

        {/* ROI calculator link */}
        <Button asChild variant="outline" className="mt-5 gap-2 border-[#770142]/40 text-[#770142] hover:bg-[#770142]/5">
          <a href={ROI_CALCULATOR_URL} target="_blank" rel="noopener noreferrer">
            See projected impact for your organization
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>
      </div>

      {/* Every campaign includes */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Every campaign includes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CAMPAIGN_INCLUDES.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: item.color + '15' }}>
                  <Icon className="w-4 h-4" style={{ color: item.color }} />
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