import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export default function CampaignContextPanel({ recipient }) {
  const recordIdField = recipient.record_type === 'client' ? 'client_id'
    : recipient.record_type === 'lead' ? 'lead_id'
    : 'referral_partner_id';

  const { data: interactions = [] } = useQuery({
    queryKey: ['campaign_ctx_interaction', recipient.record_type, recipient.record_id],
    queryFn: () => base44.entities.ClientInteraction.filter({ [recordIdField]: recipient.record_id }, '-date', 1),
    enabled: !!recipient.record_id,
  });

  const { data: emails = [] } = useQuery({
    queryKey: ['campaign_ctx_email', recipient.email],
    queryFn: () => base44.entities.EmailLog.filter({ to_email: recipient.email }, '-date', 1),
    enabled: !!recipient.email,
  });

  const lastInteraction = interactions[0];
  const lastEmail = emails[0];

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
        <ChevronDown className="w-3.5 h-3.5" />
        What Maya used
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
          <div>
            <span className="font-semibold">Last interaction:</span>{' '}
            {lastInteraction
              ? `${new Date(lastInteraction.date).toLocaleDateString()} — ${lastInteraction.subject || '(no subject)'}`
              : 'None'}
          </div>
          {lastInteraction?.notes && (
            <div>
              <span className="font-semibold">Note excerpt:</span>{' '}
              {lastInteraction.notes.slice(0, 150)}
              {lastInteraction.notes.length > 150 && '...'}
            </div>
          )}
          <div>
            <span className="font-semibold">Last email sent:</span>{' '}
            {lastEmail
              ? `${new Date(lastEmail.date).toLocaleDateString()} — ${lastEmail.subject || '(no subject)'}`
              : 'None'}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}