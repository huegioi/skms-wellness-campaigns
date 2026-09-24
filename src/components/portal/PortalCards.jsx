import React from 'react';
import { format } from 'date-fns';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';

/**
 * Presentational building blocks shared by the client (HR) portal Home tab
 * and the referral partner portal Home / Clients tabs.
 */

export function Thumb({ image, size = 'w-16 h-16' }) {
  return (
    <div className={`${size} shrink-0 rounded-md border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center`}>
      {image ? <img src={image} alt="" loading="lazy" className="w-full h-full object-contain" /> : <Sparkles className="w-6 h-6 text-gray-300" />}
    </div>
  );
}

export function CardShell({ eyebrow, children, footer }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col h-full">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{eyebrow}</p>
      <div className="flex-1">{children}</div>
      {footer}
    </div>
  );
}

export function ResultTile({ label, value, caption, extra, tone }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-3xl font-bold text-brand-navy">{value}</p>
        {tone && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tone.cls}`}>{tone.label}</span>}
      </div>
      {caption && <p className="text-xs text-gray-500 mt-1">{caption}</p>}
      {extra && <p className="text-xs text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">{extra}</p>}
    </div>
  );
}

export function HighlightsCard({ items, onNavigate }) {
  return (
    <CardShell eyebrow="Latest highlights">
      <ul className="divide-y divide-gray-100">
        {items.map(h => {
          const Icon = h.icon;
          return (
            <li key={h.key}>
              <button onClick={() => onNavigate(h.tab)} className="w-full flex items-center gap-3 py-3 text-left group">
                <span className="w-9 h-9 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-brand-green" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-800">{h.text}</span>
                  <span className="block text-xs text-gray-500">{h.sub}{h.date ? ` · ${format(new Date(h.date), 'MMM d')}` : ''}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

export function ContactCard({ contacts, company, wide }) {
  const subject = encodeURIComponent(`Check-in request${company ? ` — ${company}` : ''}`);
  return (
    <CardShell eyebrow={contacts.length > 1 ? 'Your SkillfulMeans contacts' : 'Your SkillfulMeans contact'}>
      <div className={`grid gap-4 ${wide && contacts.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {contacts.map(c => (
          <div key={c.email} className="flex items-start gap-3">
            {c.photo_url ? (
              <img src={c.photo_url} alt={c.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-12 h-12 rounded-full bg-brand-navy text-white font-semibold flex items-center justify-center shrink-0">
                {c.name.split(/\s+/).filter(w => /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('')}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-500">{c.role}</p>
              <a href={`mailto:${c.email}`} className="text-sm text-brand-navy hover:underline break-all">{c.email}</a>
              <div className="mt-2">
                <a
                  href={`mailto:${c.email}?subject=${subject}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-green hover:text-brand-green"
                >
                  <Mail className="w-3.5 h-3.5" /> Schedule a check-in
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}
