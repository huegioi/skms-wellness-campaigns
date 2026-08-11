import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link2, Copy, Loader2 } from 'lucide-react';

export default function SendOptions({ magicKey, surveyUrl, onLaunched }) {
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    navigator.clipboard.writeText(surveyUrl);
    setLaunching(true);
    try {
      await base44.functions.invoke('launchTeamAssessment', { magic_key: magicKey });
    } catch {}
    setLaunching(false);
    onLaunched({ mode: 'copy' });
  };

  return (
    <div className="mf-card border-l-4 border-l-mf-plum p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-5 h-5 text-mf-plum" />
        <h3 className="text-sm font-bold text-mf-plum">Your team survey link</h3>
      </div>
      <p className="text-xs text-mf-ink-2 mb-3">Send this link to your team yourself — you know the right channel. The survey is 3 minutes and fully anonymous.</p>
      <div className="bg-mf-cream rounded-xl p-3 border border-mf-rule mb-3">
        <p className="text-xs text-mf-ink-3 font-mono break-all select-all">{surveyUrl}</p>
      </div>
      <button
        onClick={handleLaunch}
        disabled={launching}
        className="w-full bg-mf-plum text-white rounded-full py-2.5 font-semibold text-sm hover:bg-mf-plum-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {launching ? <><Loader2 className="w-4 h-4 animate-spin" /> Launching...</> : <><Copy className="w-4 h-4" /> Copy link & launch</>}
      </button>
    </div>
  );
}