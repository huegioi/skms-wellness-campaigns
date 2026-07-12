import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

const PILLARS = [
  {
    label: 'Workshops',
    subLabel: 'INTRODUCE SKILLS',
    body: 'Introduce core mental fitness skills. Build awareness and a shared language.',
    badgeClass: 'bg-brand-journey-blue',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/b34ca7b7f_generated_image.png',
  },
  {
    label: 'Challenges',
    subLabel: 'PRACTICE & INTEGRATION',
    body: 'Turn skills into daily habits. Practice in real work-life contexts.',
    badgeClass: 'bg-brand-journey-rose',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/aeb3b45a5_generated_image.png',
  },
  {
    label: 'Coaching & Leadership EQ',
    subLabel: 'DEEPEN & EMBODY',
    body: 'Deepen skills. Support leaders in modeling behaviors.',
    badgeClass: 'bg-brand-journey-amber',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/90dfcddd2_generated_image.png',
  },
  {
    label: 'Incentives',
    subLabel: 'MOTIVATE & REINFORCE',
    body: 'Reward participation and progress. Reinforce a culture of care.',
    badgeClass: 'bg-brand-journey-sage',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/f5dacc01f_generated_image.png',
  },
];

export default function ProgramJourney() {
  return (
    <div className="mt-6 rounded-2xl p-4 md:p-6 bg-brand-cream">
      {/* Section header */}
      <div className="flex items-baseline gap-2 mb-4">
        <h4 className="font-bold text-sm text-brand-bark">A structured journey</h4>
        <span className="text-xs text-brand-bark">from learning to long-term behavior change</span>
      </div>

      {/* Four pillars */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-2">
        {PILLARS.map((p, idx) => (
          <React.Fragment key={p.label}>
            <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-brand-bark/10 flex flex-col">
              {/* Arch-topped image */}
              <div className="relative h-28 md:h-32 overflow-hidden rounded-t-[60px] md:rounded-t-[80px] rounded-b-none">
                <img src={p.image} alt={p.label} className="w-full h-full object-cover" />
              </div>
              {/* Badge bar */}
              <div className="px-4 pt-3">
                <span className={`block h-2 w-12 rounded-full ${p.badgeClass}`} />
              </div>
              {/* Text */}
              <div className="px-4 pb-4 pt-2 flex-1">
                <h4 className="font-bold text-sm leading-tight text-brand-bark">{p.label}</h4>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-brand-bark">{p.subLabel}</p>
                <p className="text-xs text-gray-600 leading-relaxed mt-1.5">{p.body}</p>
              </div>
            </div>
            {/* Connector */}
            {idx < PILLARS.length - 1 && (
              <div className="flex items-center justify-center flex-shrink-0">
                <div className="hidden lg:flex items-center">
                  <div className="border-t-2 border-dashed w-4 border-brand-bark" />
                  <ChevronRight className="w-4 h-4 text-brand-bark" />
                </div>
                <ChevronDown className="w-4 h-4 lg:hidden text-brand-bark" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

    </div>
  );
}