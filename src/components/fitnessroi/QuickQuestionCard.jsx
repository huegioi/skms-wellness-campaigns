import React from 'react';

export default function QuickQuestionCard({ label, question, options, selectedValue, onSelect }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-5 shadow-sm">
      <p className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-2">{label}</p>
      <h2 className="text-lg font-semibold text-stone-800 mb-4 leading-snug">{question}</h2>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors text-sm font-medium ${
              selectedValue === i
                ? 'bg-[#0f766e] text-white border-[#0f766e]'
                : 'bg-white text-stone-700 border-stone-200 hover:border-[#0f766e] hover:bg-stone-50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}