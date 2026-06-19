import React from 'react';

// Renders all questions for a single assessment instrument.
export default function InstrumentStep({ instrument, answers, onChange }) {
  if (!instrument) return null;

  return (
    <div className="space-y-5">
      {instrument.preamble && (
        <p className="text-sm font-semibold text-gray-700">{instrument.preamble}</p>
      )}
      {instrument.questions.map((q, qi) => (
        <div key={q.key} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-800 mb-3">
            <span className="text-[#264d44] font-bold mr-1">{qi + 1}.</span> {q.text}
          </p>
          {instrument.renderStyle === 'numeric' ? (
            <NumericScale
              min={instrument.scaleMin}
              max={instrument.scaleMax}
              lowLabel={instrument.lowLabel}
              highLabel={instrument.highLabel}
              value={answers[q.key]}
              onChange={v => onChange(q.key, v)}
            />
          ) : (
            <LabeledScale
              scale={instrument.scale}
              value={answers[q.key]}
              onChange={v => onChange(q.key, v)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function LabeledScale({ scale, value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {scale.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-xs px-3 py-2 rounded-lg border transition-all text-left ${
              selected
                ? 'bg-[#264d44] text-white border-[#264d44] font-semibold'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#264d44] hover:text-[#264d44]'
            }`}
          >
            <span className="font-bold">{opt.value}</span> — {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NumericScale({ min, max, lowLabel, highLabel, value, onChange }) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {nums.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 min-w-[2.2rem] h-12 rounded-lg font-bold text-sm transition-all border-2 ${
              value === n
                ? 'bg-[#013f7c] text-white border-[#013f7c] shadow-lg scale-105'
                : 'bg-white text-gray-500 border-gray-200 hover:border-[#013f7c]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}