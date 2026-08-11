import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, ExternalLink, Loader2 } from 'lucide-react';

const CALENDLY_URL = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';

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
    <div className="bg-mf-plum rounded-2xl p-6 text-center shadow-sm">
      <h2 className="text-xl font-bold text-white mb-2">Book a call — walk through your results with us</h2>
      <p className="text-sm text-white/80 mb-4">We'll review your team's data, talk through the domain breakdown, and recommend a concrete plan.</p>
      <p className="text-xs text-white/70 mb-4 max-w-md mx-auto leading-relaxed">On a short call we'll walk through your team's results together and map which program stage fits your goals and budget — no obligation, and your data stays private.</p>
      <button onClick={handleClick} disabled={notifying}
        className="inline-flex items-center gap-2 bg-white text-mf-plum rounded-full px-8 py-3 font-bold text-sm hover:bg-mf-cream transition-colors disabled:opacity-70">
        {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
        Book your call
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}