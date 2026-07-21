import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, ExternalLink, Loader2 } from 'lucide-react';

const CALENDLY_URL = 'https://calendly.com/skillfulmeans/skms-corporate-wellness-offerings-2';

export default function BookCallCta({ magicKey }) {
  const [notifying, setNotifying] = useState(false);

  const handleClick = () => {
    if (!notifying) {
      setNotifying(true);
      base44.functions.invoke('notifyJourneyLead', { magic_key: magicKey })
        .catch(() => {})
        .finally(() => setNotifying(false));
    }
    window.open(CALENDLY_URL, '_blank');
  };

  return (
    <div className="bg-[#0f766e] rounded-2xl p-6 text-center shadow-sm">
      <h2 className="text-xl font-bold text-white mb-2">Book a call — walk through your results with us</h2>
      <p className="text-sm text-white/80 mb-4">We'll review your team's data, talk through the domain breakdown, and recommend a concrete plan.</p>
      <button onClick={handleClick} disabled={notifying}
        className="inline-flex items-center gap-2 bg-white text-[#0f766e] rounded-full px-8 py-3 font-bold text-sm hover:bg-stone-50 transition-colors disabled:opacity-70">
        {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
        Book your call
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}