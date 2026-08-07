import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, BookOpen, ExternalLink, Award, Dumbbell, Crown, Activity, Package } from 'lucide-react';
import ServiceImage from '@/components/quickbuilder/ServiceImage';
import { BROCHURE_URL } from '@/components/quickbuilder/stagePricing';

const GROUPS = [
  { cat: 'workshop',   label: 'Workshops',         icon: Award,    blurb: 'Live, facilitated sessions. Your tier includes a set number — you choose the topics later with us.' },
  { cat: 'challenge',  label: '14-Day Challenges', icon: Dumbbell, blurb: 'Team-wide habit sprints that turn what people learned into daily practice.' },
  { cat: 'leadership', label: 'Leadership',        icon: Crown,    blurb: 'Leadership EQ programs, coaching, and the Leadership Circle Profile assessment.' },
  { cat: 'class',      label: 'Classes',           icon: Activity, blurb: 'Ongoing movement, mindfulness, and recovery classes.' },
];

/**
 * Browse-only view of everything on offer. Nothing here changes the quote —
 * the tier already sets the counts. This is here so people can see what
 * they'd be picking from before they commit.
 */
export default function ProgramGallery({ services = [], isLoading, onBack, onNext }) {
  const isExternalBrochure = /^https?:\/\//i.test(BROCHURE_URL);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">What you can choose from</h2>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Have a look around — nothing to pick right now. Your tier already sets how many of each you get, and we'll
          choose the specific topics together once you're on board. Your quote is waiting on the next step.
        </p>
      </div>

      {/* Brochure */}
      <a
        href={BROCHURE_URL}
        {...(isExternalBrochure ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex items-center gap-3 p-4 rounded-xl border border-brand-plum/25 bg-brand-plum/[0.04] hover:bg-brand-plum/[0.08] transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-brand-plum/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-brand-plum" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-800">Browse the full brochure</p>
          <p className="text-xs text-gray-500">Every workshop, challenge, and wellness box in detail</p>
        </div>
        <ExternalLink className="w-4 h-4 text-brand-plum flex-shrink-0" />
      </a>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        GROUPS.map(group => {
          const items = services.filter(s => s.category === group.cat);
          if (items.length === 0) return null;
          const Icon = group.icon;
          return (
            <div key={group.cat}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-brand-navy" />
                <h3 className="font-bold text-gray-800">{group.label}</h3>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{group.blurb}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map(svc => {
                  const image = svc.images?.[0]?.url;
                  return (
                    <div key={svc.id} className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                      <div className="relative aspect-video bg-gray-100">
                        {image ? (
                          <ServiceImage src={image} alt={svc.name} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-brand-navy/10 p-2">
                            <Package className="w-5 h-5 text-brand-navy/40" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-gray-800 leading-snug">{svc.name}</p>
                        {svc.short_description && (
                          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-snug">
                            {svc.short_description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={onNext} className="bg-brand-navy hover:bg-brand-navy-dark gap-2">
          See my quote <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
