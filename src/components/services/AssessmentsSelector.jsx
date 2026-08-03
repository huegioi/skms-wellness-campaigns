import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

const INSTRUMENTS = [
  { key: 'who5',  label: 'WHO-5',  subtitle: 'Wellbeing',        items: 5  },
  { key: 'uwes3', label: 'UWES-3', subtitle: 'Work engagement',  items: 3  },
  { key: 'pss4',  label: 'PSS-4',  subtitle: 'Perceived stress', items: 4  },
  { key: 'ucla3', label: 'UCLA-3', subtitle: 'Loneliness',       items: 3  },
  { key: 'cbi',   label: 'CBI',    subtitle: 'Burnout',          items: 6  },
];

const DEFAULTS_BY_CATEGORY = {
  workshop:    [],
  class:       [],
  leadership:  ['uwes3'],
  challenge:   ['who5'],
  wellness_box: [],
};

const TIMING_BY_CATEGORY = {
  workshop:    'At check-in (start of session)',
  class:       'At check-in (start of session)',
  leadership:  'At check-in (start of session)',
  challenge:   'Day 0 and Day 14 (pre/post)',
  wellness_box:'Not applicable',
};

// For burden estimate: challenge instruments count twice (Day 0 + Day 14)
function getBurdenPerTouchpoint(selected, category) {
  return selected.reduce((sum, key) => {
    const inst = INSTRUMENTS.find(i => i.key === key);
    return sum + (inst?.items || 0);
  }, 0);
}

export default function AssessmentsSelector({ category, value = [], onChange, isNew }) {
  // On first render for new services, apply category defaults
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isNew && !initialized) {
      onChange(DEFAULTS_BY_CATEGORY[category] || []);
      setInitialized(true);
    }
  }, [isNew, category, initialized]);

  // When category changes on a new service, reset to new defaults
  const prevCategoryRef = useRef(category);
  useEffect(() => {
    if (isNew && prevCategoryRef.current !== category) {
      onChange(DEFAULTS_BY_CATEGORY[category] || []);
      prevCategoryRef.current = category;
    }
  }, [category, isNew]);

  const toggle = (key) => {
    if (value.includes(key)) {
      onChange(value.filter(k => k !== key));
    } else {
      onChange([...value, key]);
    }
  };

  const timing = TIMING_BY_CATEGORY[category] || 'At check-in (start of session)';
  const isChallenge = category === 'challenge';

  // Burden calculation
  const itemsPerTouchpoint = getBurdenPerTouchpoint(value, category);
  const totalItems = isChallenge ? itemsPerTouchpoint * 2 : itemsPerTouchpoint;
  const approxSeconds = totalItems * 5;
  const approxMinutes = Math.ceil(approxSeconds / 60);
  const overThreshold = itemsPerTouchpoint > 12;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {INSTRUMENTS.map(inst => {
          const checked = value.includes(inst.key);
          return (
            <label
              key={inst.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                checked ? 'border-[#013f7c] bg-[#013f7c]/5' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(inst.key)}
                className="mt-0.5 w-4 h-4 accent-[#013f7c] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-800">{inst.label}</span>
                  <span className="text-xs text-gray-500">— {inst.subtitle}, {inst.items} item{inst.items !== 1 ? 's' : ''}</span>
                </div>
                {checked && (
                  <p className="text-xs text-[#013f7c] mt-0.5 font-medium">
                    ⏱ {timing}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 -mt-1">eNPS is collected automatically after every session — no need to select it.</p>

      {/* Burden estimate */}
      {value.length > 0 && (
        <div className={`rounded-lg p-3 text-sm border ${overThreshold ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-start gap-2">
            {overThreshold && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
            <div>
              <p className={`font-medium ${overThreshold ? 'text-amber-800' : 'text-gray-700'}`}>
                Survey burden:{' '}
                {isChallenge
                  ? `${itemsPerTouchpoint} items × 2 touchpoints = ${totalItems} total`
                  : `${totalItems} item${totalItems !== 1 ? 's' : ''}`
                }
                {' '}· ~{approxSeconds < 60 ? `${approxSeconds}s` : `${approxMinutes} min`} per touchpoint
              </p>
              {overThreshold && (
                <p className="text-amber-700 text-xs mt-0.5">
                  This is a long survey — consider trimming to protect response rates.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}