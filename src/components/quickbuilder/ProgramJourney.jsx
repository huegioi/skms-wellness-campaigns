import React from 'react';

/**
 * The four building blocks of a SkillfulMeans campaign.
 *
 * Rebuilt 2026-08-08 to William's process graphic: arch-topped photo, a
 * coloured pill carrying the name, then the stage and a one-line description.
 *
 * Built as components rather than dropping in the 1080p export, so the type
 * stays crisp at every size, reads on a phone, is selectable and screen-
 * readable, and the page doesn't carry a ~130KB raster. The photos are the
 * ones already hosted for this app; the pill colours are the brand accents.
 *
 * Order follows the graphic. Note it opens on Coaching rather than Workshops
 * — worth a look if this is meant to read as a sequence.
 */
const PILLARS = [
  {
    label: 'Coaching & Leadership EQ',
    stage: ['DEEPEN', '& EMBODY'],
    body: 'Deepen skills. Support leaders in modeling behaviors.',
    pill: '#E8866A',   // coral
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/90dfcddd2_generated_image.png',
  },
  {
    label: 'Workshops',
    stage: ['INTRODUCE', 'SKILLS'],
    body: 'Introduce core mental fitness skills. Build awareness and a shared language.',
    pill: '#A8BCEA',   // periwinkle
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/b34ca7b7f_generated_image.png',
  },
  {
    label: 'Challenges',
    stage: ['PRACTICE', '& INTEGRATION'],
    body: 'Turn skills into daily habits. Practice in real work-life contexts.',
    pill: '#EFCBD8',   // mauve
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/aeb3b45a5_generated_image.png',
  },
  {
    label: 'Incentives',
    stage: ['MOTIVATE', '& REINFORCE'],
    body: 'Reward participation and progress. Reinforce a culture of care.',
    pill: '#DCEE7C',   // yellow-green
    image: 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/f5dacc01f_generated_image.png',
  },
];

const PLUM = '#441D37';

export default function ProgramJourney() {
  return (
    <div className="mt-6">
      <div className="flex items-baseline gap-2 mb-5">
        <h4 className="font-bold text-sm text-brand-bark">A structured journey</h4>
        <span className="text-xs text-brand-bark">from learning to long-term behavior change</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {PILLARS.map(p => (
          <div key={p.label} className="flex flex-col">
            {/* Arch-topped photo with the name pill sitting over its base */}
            <div className="relative">
              <div className="overflow-hidden rounded-t-full rounded-b-2xl aspect-square">
                <img
                  src={p.image}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className="absolute inset-x-1 -bottom-4 rounded-full px-3 py-3 shadow-sm"
                style={{ backgroundColor: p.pill }}
              >
                <p
                  className="text-center font-serif font-semibold leading-tight text-[13px] lg:text-sm"
                  style={{ color: PLUM }}
                >
                  {p.label}
                </p>
              </div>
            </div>

            {/* Stage + description */}
            <div className="pt-9 text-center">
              <p className="font-bold text-sm tracking-wide leading-tight" style={{ color: PLUM }}>
                {p.stage[0]}<br />{p.stage[1]}
              </p>
              <hr className="my-3 mx-auto w-4/5 border-0 border-t" style={{ borderColor: PLUM }} />
              <p className="text-xs leading-relaxed px-1" style={{ color: PLUM }}>
                {p.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
