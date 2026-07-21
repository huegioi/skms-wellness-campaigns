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
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-[#0f766e]" />
        <span className="text-sm font-semibold text-[#4a2040]">Or share the link</span>
      </div>
      <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200 mb-2">
        <p className="text-xs text-stone-400 font-mono break-all">{surveyUrl}</p>
      </div>
      <button onClick={handleCopy}
        className="w-full bg-white border border-stone-200 text-stone-700 rounded-full py-2 font-medium text-xs hover:border-[#0f766e] hover:text-[#0f766e] transition-colors flex items-center justify-center gap-2">
        {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
      </button>
    </div>
  );
}