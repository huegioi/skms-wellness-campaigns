import React from 'react';

export default function QuickQuestionCard({ label, question, options, selectedValue, onSelect }) {
  return (
    <div className="mf-card border-l-4 border-l-mf-plum p-5 shadow-sm">
      <p className="text-xs uppercase tracking-widest text-mf-plum font-semibold mb-2">{label}</p>
      <h2 className="text-lg font-semibold text-mf-ink mb-4 leading-snug">{question}</h2>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors text-sm font-medium ${
              selectedValue === i
                ? 'bg-mf-plum text-white border-mf-plum'
                : 'bg-white text-mf-ink border-mf-rule hover:border-mf-plum hover:bg-mf-cream'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}