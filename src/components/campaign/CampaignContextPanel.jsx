import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, AlertTriangle } from 'lucide-react';

/**
 * Shows exactly what Maya wrote this draft from (the saved brief), which facts she
 * leaned on, and anything she thinks you should check. Drafts made before 2026-10-07
 * have no saved brief — regenerate them to see it.
 */
export default function CampaignContextPanel({ recipient }) {
  const hooks = Array.isArray(recipient.draft_hooks) ? recipient.draft_hooks : [];
  const brief = recipient.draft_context || '';

  return (
    <div className="space-y-2">
      {recipient.draft_concerns && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><span className="font-semibold">Check before sending:</span> {recipient.draft_concerns}</span>
        </div>
      )}
      {hooks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-500">Built on:</span>
          {hooks.map((h, i) => (
            <span key={i} className="rounded-full bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5">{h}</span>
          ))}
        </div>
      )}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
          <ChevronDown className="w-3.5 h-3.5" />
          What Maya knew about them
        </CollapsibleTrigger>
        <CollapsibleContent>
          {brief ? (
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-gray-700 bg-gray-50 rounded-lg p-3 max-h-80 overflow-y-auto">{brief}</pre>
          ) : (
            <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              This draft was written before Maya saved her notes. Regenerate it to see exactly what she used.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
