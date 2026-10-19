import React from 'react';
import { User, Handshake } from 'lucide-react';
import { partnerRelationship } from '@/lib/firmPartnership';

/**
 * One chip that answers "who is the deal with?" for a referral partner.
 *   🏢 Under <Firm> agreement — firm-level partnership is ACTIVE
 *   👤 Individual partner     — the deal is with this person (firm, if any, is where they work)
 */
export default function PartnerRelationshipChip({ partner, brokerages = [], className = '' }) {
  const rel = partnerRelationship(partner, brokerages);
  if (rel.kind === 'firm') {
    return (
      <span
        title={`Refers under the ${rel.firm.name} firm partnership; the firm's commission settings apply.`}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-[#013f7c]/10 text-[#013f7c] ${className}`}
      >
        <Handshake className="w-3 h-3" /> {rel.label}
      </span>
    );
  }
  return (
    <span
      title={rel.firm ? `Works at ${rel.firm.name}; no active firm deal, so the partnership is with this person.` : 'Partnership is with this person.'}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700 ${className}`}
    >
      <User className="w-3 h-3" /> {rel.label}
    </span>
  );
}
