import React from 'react';
import { Link } from 'react-router-dom';
import { Handshake } from 'lucide-react';

export default function ReferredByBadge({ partnerId, partnerName, compact = false }) {
  if (!partnerName) return null;

  const badge = (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-[#264d44]/10 text-[#264d44] transition-colors ${
      compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'
    } ${partnerId ? 'hover:bg-[#264d44]/20 cursor-pointer' : ''}`}>
      <Handshake className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      Referred by {partnerName}
    </span>
  );

  if (partnerId) {
    return (
      <Link to={`/Leads?tab=portals&partnerId=${partnerId}`} onClick={(e) => e.stopPropagation()}>
        {badge}
      </Link>
    );
  }

  return badge;
}