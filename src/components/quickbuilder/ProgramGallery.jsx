import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, ArrowLeft, BookOpen, ExternalLink, Award, Dumbbell, Crown, Activity, Package, Eye } from 'lucide-react';
import ServiceImage from '@/components/quickbuilder/ServiceImage';
import { BROCHURE_URL } from '@/lib/rateCard';

// Group headings only — the per-group paragraphs were removed 2026-08-13.
const GROUPS = [
  { cat: 'workshop',   label: 'Workshops',         icon: Award },
  { cat: 'challenge',  label: '14-Day Challenges', icon: Dumbbell },
  { cat: 'leadership', label: 'Leadership',        icon: Crown },
  { cat: 'class',      label: 'Classes',           icon: Activity },
];

/**
 * For nearly every service, short_description is just the first ~150 characters
 * of description, chopped mid-word — so printing both in the dialog showed the
 * same sentence twice. Only treat it as a real subtitle when it isn't already
 * contained in the long copy.
 */
const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

function subtitleFor(svc) {
  const short = (svc.short_description || '').trim();
  const full = (svc.description || '').trim();
  if (!short || !full) return null;                 // nothing to duplicate against
  const a = normalize(short);
  const b = normalize(full);
  if (!a) return null;
  return b.includes(a.slice(0, 60)) ? null : short;
}

/**
 * Browse-only view of everything on offer. Nothing here changes the quote —
 * the tier already sets the counts. This is here so people can see what
 * they'd be picking from before they commit.
 */
export default function ProgramGallery({
  services = [],
  isLoading,
  onBack,
  onNext,
  nextLabel = 'See my quote',
  isSubmitting = false,
}) {
  const isExternalBrochure = /^https?:\/\//i.test(BROCHURE_URL);
  // The service images are the branded cards, which already carry the title —
  // so the grid stays clean and the words live in the dialog.
  const [openService, setOpenService] = useState(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">What you can choose from</h2>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Have a look around — nothing to pick right now. Your tier already sets how many of each you get, and we'll
          choose the specific topics together once you're on board. When you're ready, send your details over and
          we'll show you the quote.
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
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-brand-navy" />
                <h3 className="font-bold text-gray-800">{group.label}</h3>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map(svc => {
                  const image = svc.images?.[0]?.url;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setOpenService(svc)}
                      className="group text-left rounded-xl overflow-hidden border border-gray-100 shadow-sm
                                 hover:shadow-md hover:border-brand-navy/30 transition-all"
                    >
                      <div className="relative aspect-video bg-gray-100">
                        {image ? (
                          <ServiceImage src={image} alt={svc.name} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-brand-navy/10 p-2">
                            <Package className="w-5 h-5 text-brand-navy/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 py-2
                                      text-[11px] font-medium text-brand-navy/70 group-hover:text-brand-navy">
                        <Eye className="w-3.5 h-3.5" />
                        View description
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <Dialog open={!!openService} onOpenChange={o => !o && setOpenService(null)}>
        <DialogContent className="max-w-lg">
          {openService && (
            <>
              {openService.images?.[0]?.url && (
                <div className="relative aspect-video rounded-xl overflow-hidden -mt-2">
                  <ServiceImage
                    src={openService.images[0].url}
                    alt={openService.name}
                    className="w-full h-full"
                  />
                </div>
              )}
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-lg leading-snug">{openService.name}</DialogTitle>
                {subtitleFor(openService) && (
                  <p className="text-sm text-brand-plum">{subtitleFor(openService)}</p>
                )}
              </DialogHeader>
              {(openService.description || openService.short_description) ? (
                <p className="text-sm text-gray-600 leading-relaxed max-h-64 overflow-y-auto">
                  {openService.description || openService.short_description}
                </p>
              ) : (
                <p className="text-sm text-gray-400">No description added for this one yet.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* This button now sends the inquiry as well as advancing, so it takes
          the plum submit styling and says what it's about to do. */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          onClick={onNext}
          disabled={isSubmitting}
          className="bg-brand-plum hover:bg-brand-plum-dark gap-2"
        >
          {isSubmitting ? 'Sending…' : <>{nextLabel} <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </div>
    </div>
  );
}
