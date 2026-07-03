import React from 'react';
import { ChevronRight, ChevronDown, Users } from 'lucide-react';

const PURPLE = '#422E33';

const PILLARS = [
  {
    label: 'Workshops',
    subLabel: 'INTRODUCE SKILLS',
    body: 'Introduce core mental fitness skills. Build awareness and a shared language.',
    badge: '#C5D4F2',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/b34ca7b7f_generated_image.png',
  },
  {
    label: 'Challenges',
    subLabel: 'PRACTICE & INTEGRATION',
    body: 'Turn skills into daily habits. Practice in real work-life contexts.',
    badge: '#F2D4D4',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/aeb3b45a5_generated_image.png',
  },
  {
    label: 'Coaching & Leadership EQ',
    subLabel: 'DEEPEN & EMBODY',
    body: 'Deepen skills. Support leaders in modeling behaviors.',
    badge: '#F2C2A6',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/90dfcddd2_generated_image.png',
  },
  {
    label: 'Incentives',
    subLabel: 'MOTIVATE & REINFORCE',
    body: 'Reward participation and progress. Reinforce a culture of care.',
    badge: '#E6F2B8',
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/f5dacc01f_generated_image.png',
  },
];

export default function ProgramJourney() {
  return (
    <div className="mt-6 rounded-2xl p-4 md:p-6" style={{ backgroundColor: '#F7F3EF' }}>
      {/* Subtitle */}
      <p className="text-center text-sm mb-5" style={{ color: PURPLE }}>
        A <strong>structured journey</strong> from learning to long-term behavior change.
      </p>

      {/* Four pillars */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-2">
        {PILLARS.map((p, idx) => (
          <React.Fragment key={p.label}>
            <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border flex flex-col" style={{ borderColor: PURPLE + '1a' }}>
              {/* Arch-topped image */}
              <div className="relative h-28 md:h-32 overflow-hidden rounded-t-[60px] md:rounded-t-[80px] rounded-b-none">
                <img src={p.image} alt={p.label} className="w-full h-full object-cover" />
              </div>
              {/* Badge bar */}
              <div className="px-4 pt-3">
                <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: p.badge }} />
              </div>
              {/* Text */}
              <div className="px-4 pb-4 pt-2 flex-1">
                <h4 className="font-bold text-sm leading-tight" style={{ color: PURPLE }}>{p.label}</h4>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: PURPLE }}>{p.subLabel}</p>
                <p className="text-xs text-gray-600 leading-relaxed mt-1.5">{p.body}</p>
              </div>
            </div>
            {/* Connector */}
            {idx < PILLARS.length - 1 && (
              <div className="flex items-center justify-center flex-shrink-0">
                <div className="hidden lg:flex items-center">
                  <div className="border-t-2 border-dashed w-4" style={{ borderColor: PURPLE }} />
                  <ChevronRight className="w-4 h-4" style={{ color: PURPLE }} />
                </div>
                <ChevronDown className="w-4 h-4 lg:hidden" style={{ color: PURPLE }} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Vertical connector + outcome */}
      <div className="flex flex-col items-center mt-4">
        <div className="border-l-2 border-dashed h-6" style={{ borderColor: PURPLE }} />
        <div className="w-16 h-16 rounded-full bg-white border-2 flex items-center justify-center shadow-sm" style={{ borderColor: PURPLE }}>
          <Users className="w-7 h-7" style={{ color: PURPLE }} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: PURPLE }}>Long-Term Team Resilience</p>
      </div>
    </div>
  );
}