import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Award, Dumbbell, Users, Package } from 'lucide-react';
import AssessmentBadges from '@/components/assessments/AssessmentBadges';
import { buildSelectionResolver, prettifyServiceKey } from '@/lib/serviceMatching';
import { BOX_DISPLAY_NAMES, BOX_KEY_TO_SERVICE_NAME } from '@/lib/wellnessBoxes';

const categoryIcons = { workshops: Award, challengePrograms: Dumbbell, leadership: Users, movementClasses: Dumbbell };
const categoryLabels = { workshops: 'Workshops', challengePrograms: '14-Day Challenges', leadership: 'Leadership Programs', movementClasses: 'Movement & Mindfulness Classes' };
const categoryColors = { workshops: '#264d44', challengePrograms: '#ff9878', leadership: '#770142', movementClasses: '#013f7c' };

export default function ClientProposalView({ proposals: propsList, proposal: singleProposal, client, services = [] }) {
  // Normalize: accept single proposal or array
  const proposals = propsList?.length > 0 ? propsList : singleProposal ? [singleProposal] : [];

  // Resolve a selection entry to a live Service. Selections normally hold
  // Service IDs; older/demo proposals hold slugs, so the resolver falls back
  // to name matching rather than printing the raw key.
  const resolveService = React.useMemo(() => buildSelectionResolver(services), [services]);

  if (proposals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Programming Yet</h3>
        <p className="text-gray-500">Your wellness programming will appear here once it's created.</p>
      </div>
    );
  }

  const totalAmount = proposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Total Investment Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl text-brand-navy">Your Wellness Programming</CardTitle>
              <p className="text-gray-500 mt-1">Total Programming Investment</p>
            </div>
            <div className="text-3xl font-bold text-brand-plum">
              ${totalAmount.toLocaleString()}
            </div>
          </div>
        </CardHeader>
      </Card>

      {proposals.map((p) => {
        const selections = p.selections || {};

        return (
          <Card key={p.id} className="border-2 border-brand-green">
            <CardHeader className="pb-4" style={{ backgroundColor: '#264d4410' }}>
              <CardTitle className="text-lg text-brand-green">
                Program Created: {new Date(p.created_date).toLocaleDateString()}
              </CardTitle>
              {p.matched_stage && (
                <p className="text-sm text-gray-500 mt-0.5">{p.matched_stage} engagement</p>
              )}
              {p.narrative_summary && (
                <p className="text-gray-700 mt-2 leading-relaxed">{p.narrative_summary}</p>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Services by category */}
                {['workshops', 'challengePrograms', 'leadership', 'movementClasses'].map(category => {
                  const items = selections[category] || [];
                  if (items.length === 0) return null;
                  const Icon = categoryIcons[category];
                  const color = categoryColors[category];

                  return (
                    <div key={category}>
                      <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color }}>
                        <Icon className="w-5 h-5" />
                        {categoryLabels[category]}
                      </h3>
                      <div className="space-y-3 ml-7">
                        {items.map(key => {
                          const service = resolveService(key);
                          const title = service?.name || prettifyServiceKey(key);
                          const blurb = service?.short_description || service?.description;
                          const imageUrl = service?.images?.[0]?.url;

                          return (
                            <div key={key} className="border rounded-lg bg-gray-50 overflow-hidden">
                              <div className="flex flex-col sm:flex-row">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={title}
                                    loading="lazy"
                                    className="w-full h-32 sm:w-32 sm:h-auto sm:self-stretch object-cover flex-shrink-0 bg-gray-100"
                                  />
                                ) : (
                                  <div
                                    className="hidden sm:flex w-32 flex-shrink-0 items-center justify-center bg-gray-100"
                                    style={{ color }}
                                    aria-hidden="true"
                                  >
                                    <Icon className="w-7 h-7 opacity-40" />
                                  </div>
                                )}
                                <div className="p-4 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <h4 className="font-semibold text-gray-800">{title}</h4>
                                    {service?.duration && (
                                      <span className="text-xs text-gray-500 whitespace-nowrap">{service.duration}</span>
                                    )}
                                  </div>
                                  {blurb && (
                                    <p className="text-gray-600 text-sm leading-relaxed mt-1.5">{blurb}</p>
                                  )}
                                  {service?.included_assessments?.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs text-gray-400 mb-1">Includes assessments:</p>
                                      <AssessmentBadges assessments={service.included_assessments} size="xs" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Wellness Boxes */}
                {(() => {
                  // Quantities are a { key: qty } map. Older/demo proposals stored a
                  // plain array of box keys instead — treat each entry as one box so
                  // the section still renders rather than silently disappearing.
                  const raw = selections.sampleBoxQuantities || selections.wellnessBoxes || {};
                  const entries = Array.isArray(raw)
                    ? raw.map(k => [k, 1])
                    : Object.entries(raw).filter(([, qty]) => Number(qty) > 0);
                  const customQty = Number(selections.customBoxQuantity) || 0;
                  if (entries.length === 0 && customQty === 0) return null;

                  const boxCard = (label, qty, service, k) => (
                    <div key={k} className="border rounded-lg bg-gray-50 overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        {service?.images?.[0]?.url ? (
                          <img
                            src={service.images[0].url}
                            alt={label}
                            loading="lazy"
                            className="w-full h-32 sm:w-32 sm:h-auto sm:self-stretch object-cover flex-shrink-0 bg-gray-100"
                          />
                        ) : (
                          <div className="hidden sm:flex w-32 flex-shrink-0 items-center justify-center bg-gray-100 text-brand-green" aria-hidden="true">
                            <Package className="w-7 h-7 opacity-40" />
                          </div>
                        )}
                        <div className="p-4 flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h4 className="font-semibold text-gray-800">{label}</h4>
                            <span className="text-xs text-gray-500 whitespace-nowrap">Qty {qty}</span>
                          </div>
                          {(service?.short_description || service?.description) && (
                            <p className="text-gray-600 text-sm leading-relaxed mt-1.5">
                              {service.short_description || service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold mb-3 text-brand-green">
                        <Package className="w-5 h-5" />
                        Wellness Boxes
                      </h3>
                      <div className="space-y-3 ml-7">
                        {entries.map(([boxKey, qty]) => {
                          const service =
                            resolveService(BOX_KEY_TO_SERVICE_NAME[boxKey]) || resolveService(boxKey);
                          const label =
                            BOX_DISPLAY_NAMES[boxKey] || service?.name || prettifyServiceKey(boxKey);
                          return boxCard(label, qty, service, boxKey);
                        })}
                        {customQty > 0 && boxCard('Custom Wellness Box', customQty, null, '__custom')}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}