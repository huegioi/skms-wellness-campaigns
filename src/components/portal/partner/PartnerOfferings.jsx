import React, { useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * "What we offer your clients" — built live from the Services catalog (active
 * services only), with the full course image and a complete description, so
 * it never drifts from what SkillfulMeans actually sells. Same image/blurb
 * treatment as the client portal's Programming tab.
 */

const CATEGORY_LABELS = {
  workshop: 'Workshops',
  challenge: '14-Day Challenges',
  challenges: '14-Day Challenges',
  leadership: 'Leadership',
  class: 'Classes',
  wellness_box: 'Wellness Boxes',
};
const CATEGORY_ORDER = ['workshop', 'challenge', 'leadership', 'class', 'wellness_box'];

// Use the short description only when it reads as a finished sentence; some
// were saved cut off mid-word at 150 chars.
function blurb(s) {
  const short = (s.short_description || '').trim();
  const full = (s.description || '').trim();
  if (short && (/[.!?…"”')]$/.test(short) || !full)) return short;
  return full || short;
}

export default function PartnerOfferings({ services = [] }) {
  const catalog = useMemo(() => services
    .filter(s => s.is_active !== false && s.name && !/^zz\b|\btest\b/i.test(s.name))
    .map(s => ({ ...s, cat: s.category === 'challenges' ? 'challenge' : s.category })), [services]);
  const cats = CATEGORY_ORDER.filter(c => catalog.some(s => s.cat === c));
  const [cat, setCat] = useState(null);
  const active = cat && cats.includes(cat) ? cat : cats[0];
  const items = catalog.filter(s => s.cat === active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="w-5 h-5 text-brand-green" />
          What We Offer Your Clients
        </CardTitle>
        <p className="text-sm text-gray-500">The programs your referred clients can choose from — always current with our catalog.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {cats.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {cats.map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${active === c ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {CATEGORY_LABELS[c] || c} ({catalog.filter(s => s.cat === c).length})
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {items.map(s => (
            <div key={s.id} className="flex flex-col sm:flex-row border rounded-lg bg-gray-50 overflow-hidden">
              {s.images?.[0]?.url ? (
                <img src={s.images[0].url} alt={s.name} loading="lazy" className="w-full h-auto sm:w-40 sm:self-start flex-shrink-0 bg-gray-100" />
              ) : null}
              <div className="p-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="font-semibold text-gray-800 leading-snug">{s.name}</p>
                  {s.duration && <span className="text-xs text-gray-500">{s.duration}</span>}
                </div>
                {blurb(s) && <p className="text-sm text-gray-600 mt-1 line-clamp-4">{blurb(s)}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-[#e6e1d8] bg-[#f9f8f5] p-3 text-sm text-gray-700">
          <span className="font-semibold text-brand-navy">For you, too:</span> every partner gets a complimentary annual workshop for their own team — virtual or in-person.
        </div>
      </CardContent>
    </Card>
  );
}
