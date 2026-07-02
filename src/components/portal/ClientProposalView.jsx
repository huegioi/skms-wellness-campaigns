import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Award, Dumbbell, Users, Package } from 'lucide-react';
import AssessmentBadges from '@/components/assessments/AssessmentBadges';

const categoryIcons = { workshops: Award, challengePrograms: Dumbbell, leadership: Users, movementClasses: Dumbbell };
const categoryLabels = { workshops: 'Workshops', challengePrograms: '14-Day Challenges', leadership: 'Leadership Programs', movementClasses: 'Movement & Mindfulness Classes' };
const categoryColors = { workshops: '#264d44', challengePrograms: '#ff9878', leadership: '#770142', movementClasses: '#013f7c' };

export default function ClientProposalView({ proposals: propsList, proposal: singleProposal, client, services = [] }) {
  // Normalize: accept single proposal or array
  const proposals = propsList?.length > 0 ? propsList : singleProposal ? [singleProposal] : [];

  // Build lookup map from live Service entity
  const serviceMap = React.useMemo(() => {
    const map = {};
    services.forEach(s => { map[s.id] = s; });
    return map;
  }, [services]);

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
                          const service = serviceMap[key];
                          return (
                            <div key={key} className="border rounded-lg p-4 bg-gray-50">
                              <h4 className="font-semibold text-gray-800 mb-1">
                                {service ? service.name : key}
                              </h4>
                              {service?.short_description && (
                                <p className="text-gray-600 text-sm leading-relaxed">{service.short_description}</p>
                              )}
                              {service?.description && !service?.short_description && (
                                <p className="text-gray-600 text-sm leading-relaxed">{service.description}</p>
                              )}
                              {service?.duration && (
                                <p className="text-sm text-gray-500 mt-2"><strong>Duration:</strong> {service.duration}</p>
                              )}
                              {service?.included_assessments?.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-400 mb-1">Includes assessments:</p>
                                  <AssessmentBadges assessments={service.included_assessments} size="xs" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Wellness Boxes */}
                {(() => {
                  const boxes = selections.sampleBoxQuantities || selections.wellnessBoxes || {};
                  const hasBoxes = Object.values(boxes).some(v => v > 0) || selections.customBoxQuantity > 0;
                  if (!hasBoxes) return null;
                  return (
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold mb-3 text-brand-green">
                        <Package className="w-5 h-5" />
                        Wellness Boxes
                      </h3>
                      <div className="space-y-2 ml-7">
                        {boxes.reduceStress > 0 && <div className="p-3 bg-gray-50 rounded-lg">Reduce Stress Boxes ({boxes.reduceStress})</div>}
                        {boxes.relaxationSleep > 0 && <div className="p-3 bg-gray-50 rounded-lg">Relaxation & Sleep Boxes ({boxes.relaxationSleep})</div>}
                        {boxes.largeEmotional > 0 && <div className="p-3 bg-gray-50 rounded-lg">Large Emotional Wellness Boxes ({boxes.largeEmotional})</div>}
                        {boxes.largeStressReduction > 0 && <div className="p-3 bg-gray-50 rounded-lg">Large Stress Reduction Boxes ({boxes.largeStressReduction})</div>}
                        {selections.customBoxQuantity > 0 && <div className="p-3 bg-gray-50 rounded-lg">Custom Wellness Boxes ({selections.customBoxQuantity})</div>}
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