import React from 'react';
import SavingsChart, { DRIVERS } from '@/components/fitnessroi/dashboard/SavingsChart';

/**
 * Public Journey version of the three-year ramp. Same chart, same drivers, same
 * ramp and decay constants as the dashboard — there is only one model, so there
 * is only one chart. The y-axis is free here because there is nothing to
 * compare it against on this screen.
 */
export default function RoiRampChart({ drivers }) {
  return (
    <div>
      <SavingsChart drivers={drivers} />
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        {DRIVERS.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[11px] text-mf-ink-2">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-mf-ink-3 italic text-center mt-2">
        Year one is partial — effects build as the program matures, while reach falls away without
        re-prompting. Both are in the figures.
      </p>
    </div>
  );
}
