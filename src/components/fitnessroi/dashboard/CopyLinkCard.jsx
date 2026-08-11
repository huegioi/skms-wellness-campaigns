import React, { useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';

export default function CopyLinkCard({ surveyUrl }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mf-card border-l-4 border-l-mf-plum p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-mf-plum" />
        <span className="text-sm font-semibold text-mf-plum">Or share the link</span>
      </div>
      <div className="bg-mf-cream rounded-xl p-2.5 border border-mf-rule mb-2">
        <p className="text-xs text-mf-ink-3 font-mono break-all">{surveyUrl}</p>
      </div>
      <button onClick={handleCopy}
        className="w-full bg-white border border-mf-rule text-mf-ink rounded-full py-2 font-medium text-xs hover:border-mf-plum hover:text-mf-plum transition-colors flex items-center justify-center gap-2">
        {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
      </button>
    </div>
  );
}