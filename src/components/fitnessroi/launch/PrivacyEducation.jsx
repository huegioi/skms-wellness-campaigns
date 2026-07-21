import React from 'react';
import { ShieldCheck, EyeOff, Users, Lock } from 'lucide-react';

const CARDS = [
  { icon: EyeOff, title: 'Fully anonymous', text: 'No names, no emails, no accounts. Survey responses cannot be traced back to any individual.' },
  { icon: ShieldCheck, title: 'Individual responses are private', text: 'Your company will never see what any single person answered — not you, not HR, not leadership.' },
  { icon: Users, title: 'Only team-level aggregates', text: 'Results are shown as group averages across the whole team. That is all anyone sees.' },
  { icon: Lock, title: 'Domain breakdowns lock at 5+', text: 'Until at least 5 employees respond, domain-level breakdowns stay hidden. This protects anonymity in small teams.' },
];

export default function PrivacyEducation() {
  return (
    <div>
      <h2 className="text-lg font-bold text-[#4a2040] mb-1">How we protect your team's privacy</h2>
      <p className="text-xs text-stone-500 mb-3">Everything below is true by design — not a promise.</p>
      <div className="grid grid-cols-1 gap-3">
        {CARDS.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-4 flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#0f766e]/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-[#0f766e]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">{c.title}</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{c.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}