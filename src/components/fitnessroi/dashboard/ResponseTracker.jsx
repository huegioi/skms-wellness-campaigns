import React from 'react';

export default function ResponseTracker({ count }) {
  const target = 5;
  const progress = Math.min(count / target, 1);
  const size = 120;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  const unlocked = count >= target;

  return (
    <div className="mf-card border-l-4 border-l-mf-plum p-6 shadow-sm">
      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e7e5e4" strokeWidth="8" />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#441D37" strokeWidth="8"
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-mf-ink">{count}</span>
            <span className="text-[10px] text-mf-ink-3">of {target}</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-mf-plum">
            {count === 0 ? 'No responses yet' : `${count} ${count === 1 ? 'person has' : 'people have'} responded`}
          </p>
          <p className="text-xs text-mf-ink-2 mt-1 leading-relaxed">
            {unlocked
              ? 'Domain results are unlocked — your dashboard is live.'
              : 'Domain results unlock at 5 responses to protect anonymity in small teams.'}
          </p>
        </div>
      </div>
    </div>
  );
}