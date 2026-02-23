import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, DollarSign, CheckCircle, Clock, Award, Dumbbell, Users, Package } from 'lucide-react';
import { productCatalog } from '@/components/curriculum/catalogData';
import { calculateChallengePrice } from '@/components/curriculum/pricingUtils';

export default function ClientProposalView({ proposals = [], client }) {
  if (!proposals || proposals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Programming Yet</h3>
        <p className="text-gray-500">Your wellness programming will appear here once it's created.</p>
      </div>
    );
  }

  // Calculate total across all proposals
  const totalAmount = proposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);



  // Map category -> enriched data key stored on proposal
  const enrichedDataKey = {
    workshops: 'workshopsData',
    challengePrograms: 'challengeProgramsData',
    leadership: 'leadershipData',
    movementClasses: 'movementClassesData'
  };

  const catalogCategoryKey = {
    workshops: 'workshops',
    challengePrograms: 'challenges',
    leadership: 'leadership',
    movementClasses: 'movementClasses'
  };

  const getServiceDetails = (category, key, selections) => {
    // 1. Try enriched data saved on the proposal
    const dataKey = enrichedDataKey[category];
    if (dataKey && selections[dataKey]) {
      const enriched = selections[dataKey].find(s => s.id === key);
      if (enriched) return enriched;
    }
    // 2. Fall back to static catalog
    const catKey = catalogCategoryKey[category];
    return catKey ? productCatalog[catKey]?.[key] : null;
  };

  const categoryIcons = {
    workshops: Award,
    challengePrograms: Dumbbell,
    leadership: Users,
    movementClasses: Dumbbell
  };

  const categoryLabels = {
    workshops: 'Workshops',
    challengePrograms: '14-Day Challenges',
    leadership: 'Leadership Programs',
    movementClasses: 'Movement & Mindfulness Classes'
  };

  const categoryColors = {
    workshops: '#264d44',
    challengePrograms: '#ff9878',
    leadership: '#770142',
    movementClasses: '#013f7c'
  };

  return (
    <div className="space-y-6">
      {/* Total Investment Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl" style={{ color: '#013f7c' }}>
                Your Wellness Programming
              </CardTitle>
              <p className="text-gray-500 mt-1">
                Total Programming Investment
              </p>
            </div>
            <div className="text-3xl font-bold" style={{ color: '#770142' }}>
              ${totalAmount.toLocaleString()}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Proposals grouped */}
      {proposals.map((proposal) => {
        const selections = proposal.selections || {};
        
        return (
          <Card key={proposal.id} className="border-2" style={{ borderColor: '#264d44' }}>
            <CardHeader className="pb-4" style={{ backgroundColor: '#264d4410' }}>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg" style={{ color: '#264d44' }}>
                    Program Created: {new Date(proposal.created_date).toLocaleDateString()}
                  </CardTitle>
                  {proposal.narrative_summary && (
                    <p className="text-gray-700 mt-2 leading-relaxed">{proposal.narrative_summary}</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Services */}
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
                          const service = getServiceDetails(category, key, selections);
                          if (!service) return (
                            <div key={key} className="border rounded-lg p-4 bg-gray-50">
                              <h4 className="font-semibold text-gray-800">{key}</h4>
                            </div>
                          );

                          return (
                            <div key={key} className="border rounded-lg p-4 bg-gray-50">
                              <h4 className="font-semibold text-gray-800 mb-1">{service.name}</h4>
                              <p className="text-gray-600 text-sm leading-relaxed">{service.description}</p>
                              {service.duration && (
                                <p className="text-sm text-gray-500 mt-2">
                                  <strong>Duration:</strong> {service.duration}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Wellness Boxes */}
                {(selections.sampleBoxQuantities || selections.wellnessBoxes || selections.customBoxQuantity > 0) && (
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold mb-3" style={{ color: '#264d44' }}>
                      <Package className="w-5 h-5" />
                      Wellness Boxes
                    </h3>
                    <div className="space-y-2 ml-7">
                      {(() => {
                        const boxes = selections.sampleBoxQuantities || selections.wellnessBoxes || {};
                        return (
                          <>
                            {boxes.reduceStress > 0 && (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <span>Reduce Stress Boxes ({boxes.reduceStress})</span>
                              </div>
                            )}
                            {boxes.relaxationSleep > 0 && (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <span>Relaxation & Sleep Boxes ({boxes.relaxationSleep})</span>
                              </div>
                            )}
                            {boxes.largeEmotional > 0 && (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <span>Large Emotional Wellness Boxes ({boxes.largeEmotional})</span>
                              </div>
                            )}
                            {boxes.largeStressReduction > 0 && (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <span>Large Stress Reduction Boxes ({boxes.largeStressReduction})</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}