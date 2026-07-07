import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CheckCircle, Clock, Circle, ClipboardList, MessageSquare, Calendar } from 'lucide-react';

const HEALTH_COLORS = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500' };
const HEALTH_LABELS = { green: 'On track', amber: 'Needs attention', red: 'At risk' };

function HealthDot({ health }) {
  if (!health) return null;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${HEALTH_COLORS[health] || 'bg-gray-300'}`}
      title={`Health: ${HEALTH_LABELS[health] || health}`}
    />
  );
}

function PresenterIcon({ status }) {
  if (status === 'accepted') return <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" title="Presenter accepted" />;
  if (status === 'assigned') return <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" title="Presenter assigned, awaiting acceptance" />;
  if (status === 'unassigned') return <Circle className="w-3 h-3 text-gray-400 flex-shrink-0" title="No presenter assigned" />;
  return null;
}

export default function ClientDeliveryStrip({ snapshot, client }) {
  const queryClient = useQueryClient();

  if (!snapshot) return null;

  const {
    totalServices,
    deliveredCount,
    nextEvent,
    presenterStatus,
    challengeAssessment,
    feedbackCount,
    renewal,
    health,
    hasAcceptedProposals,
  } = snapshot;

  const showProgress = hasAcceptedProposals && totalServices > 0;
  const showRenewal = !!renewal;

  if (!showProgress && !showRenewal) return null;

  const handleRenewalClick = (e) => {
    e.stopPropagation();
    if (renewal?.suggestMove) {
      toast(`Renewal in ${renewal.daysUntil}d — consider moving to Renewal Outreach.`, {
        action: {
          label: 'Move now',
          onClick: async () => {
            try {
              await base44.entities.Client.update(client.id, {
                client_stage: 'renewal_outreach',
                stage_entered_date: new Date().toISOString().split('T')[0],
              });
              queryClient.invalidateQueries({ queryKey: ['clients'] });
              toast.success('Moved to Renewal Outreach');
            } catch (err) {
              toast.error('Failed to move: ' + err.message);
            }
          },
        },
        duration: 10000,
      });
    } else {
      toast.info(`Renews in ${renewal.daysUntil}d`);
    }
  };

  return (
    <div className="mt-1.5 mb-0.5 space-y-1 text-[10px]">
      {showProgress && (
        <>
          {/* Progress + health dot */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium">{deliveredCount} of {totalServices} delivered</span>
            <HealthDot health={health} />
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#264d44] rounded-full transition-all"
              style={{ width: `${totalServices > 0 ? (deliveredCount / totalServices) * 100 : 0}%` }}
            />
          </div>

          {/* Next event + presenter status */}
          {nextEvent ? (
            <div className="flex items-center gap-1 text-gray-500 min-w-0">
              <PresenterIcon status={presenterStatus} />
              <span className="truncate">next: {nextEvent.title}</span>
              <span className="text-gray-400 flex-shrink-0">
                {new Date(nextEvent.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-400 italic">
              <Calendar className="w-3 h-3" />
              <span>no upcoming sessions</span>
            </div>
          )}

          {/* Assessment signal — challenges: D0/D14 */}
          {challengeAssessment && (
            <div className="flex items-center gap-1 text-gray-500">
              <ClipboardList className="w-3 h-3 flex-shrink-0" />
              <span>D0 {challengeAssessment.d0 ? '✓' : '—'} · D14 {challengeAssessment.d14 ? '✓' : '—'}</span>
            </div>
          )}

          {/* Assessment signal — non-challenges: feedback count */}
          {feedbackCount > 0 && (
            <div className="flex items-center gap-1 text-gray-500">
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              <span>{feedbackCount} feedback response{feedbackCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </>
      )}

      {/* Renewal chip */}
      {showRenewal && (
        <button
          onClick={handleRenewalClick}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${
            renewal.suggestMove
              ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
              : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
          }`}
        >
          🔁 renews in {renewal.daysUntil}d
        </button>
      )}
    </div>
  );
}