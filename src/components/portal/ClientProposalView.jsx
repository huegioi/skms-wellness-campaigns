import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, DollarSign, CheckCircle, Clock, Award, Dumbbell, Users, Package } from 'lucide-react';
import { productCatalog } from '@/components/curriculum/catalogData';

export default function ClientProposalView({ proposal, client }) {
  if (!proposal) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Proposal Yet</h3>
        <p className="text-gray-500">Your wellness program proposal will appear here once it's created.</p>
      </div>
    );
  }

  const statusConfig = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
    sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Clock },
    viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Clock },
    accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: Clock }
  };

  const status = statusConfig[proposal.status || 'draft'];
  const selections = proposal.selections || {};

  const getServiceDetails = (category, key) => {
    const categoryMap = {
      workshops: productCatalog.workshops,
      challengePrograms: productCatalog.challenges,
      leadership: productCatalog.leadership,
      movementClasses: productCatalog.movementClasses
    };
    return categoryMap[category]?.[key];
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
      {/* Proposal Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl" style={{ color: '#013f7c' }}>
                Your Wellness Program
              </CardTitle>
              <p className="text-gray-500 mt-1">
                Created: {new Date(proposal.created_date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={status.color}>
                <status.icon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              <div className="text-2xl font-bold" style={{ color: '#770142' }}>
                ${proposal.total_amount?.toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Narrative Summary */}
      {proposal.narrative_summary && (
        <Card className="border-l-4" style={{ borderLeftColor: '#770142' }}>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-lg mb-3" style={{ color: '#770142' }}>
              Program Overview
            </h3>
            <p className="text-gray-700 leading-relaxed">{proposal.narrative_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Services */}
      {['workshops', 'challengePrograms', 'leadership', 'movementClasses'].map(category => {
        const items = selections[category] || [];
        if (items.length === 0) return null;

        const Icon = categoryIcons[category];
        const color = categoryColors[category];

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg" style={{ color }}>
                <Icon className="w-5 h-5" />
                {categoryLabels[category]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map(key => {
                  const service = getServiceDetails(category, key);
                  if (!service) return null;

                  return (
                    <div key={key} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-800">{service.name}</h4>
                        <span className="font-semibold" style={{ color: '#770142' }}>
                          ${service.price?.toLocaleString()}
                        </span>
                      </div>
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
            </CardContent>
          </Card>
        );
      })}

      {/* Wellness Boxes */}
      {(selections.sampleBoxQuantities || selections.customBoxQuantity > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: '#264d44' }}>
              <Package className="w-5 h-5" />
              Wellness Boxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selections.sampleBoxQuantities?.reduceStress > 0 && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span>Reduce Stress Boxes ({selections.sampleBoxQuantities.reduceStress})</span>
                  <span className="font-semibold">${(selections.sampleBoxQuantities.reduceStress * 65).toLocaleString()}</span>
                </div>
              )}
              {selections.sampleBoxQuantities?.relaxationSleep > 0 && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span>Relaxation & Sleep Boxes ({selections.sampleBoxQuantities.relaxationSleep})</span>
                  <span className="font-semibold">${(selections.sampleBoxQuantities.relaxationSleep * 65).toLocaleString()}</span>
                </div>
              )}
              {selections.sampleBoxQuantities?.largeEmotional > 0 && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span>Large Emotional Wellness Boxes ({selections.sampleBoxQuantities.largeEmotional})</span>
                  <span className="font-semibold">${(selections.sampleBoxQuantities.largeEmotional * 125).toLocaleString()}</span>
                </div>
              )}
              {selections.sampleBoxQuantities?.largeStressReduction > 0 && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span>Large Stress Reduction Boxes ({selections.sampleBoxQuantities.largeStressReduction})</span>
                  <span className="font-semibold">${(selections.sampleBoxQuantities.largeStressReduction * 125).toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}