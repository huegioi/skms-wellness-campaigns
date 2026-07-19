import React from 'react';
import { CalendarCheck, TrendingUp } from 'lucide-react';

const CALENDLY_URL = 'https://calendly.com/skillfulmeans/strategy-session';
const ROI_ENGINE_BASE = 'https://skillfulmeans-roi-production.up.railway.app/';

export default function MfsCtaPair({ employeeCount, size = 'default' }) {
  const roiUrl = ROI_ENGINE_BASE + (employeeCount ? `?headcount=${encodeURIComponent(employeeCount)}` : '');
  const py = size === 'large' ? 'py-3.5' : 'py-3';
  const textSize = size === 'large' ? 'text-base' : 'text-sm';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {/* Primary — Book session */}
      <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
        <div className={`w-full bg-[#770142] hover:bg-[#5a0132] text-white rounded-xl ${py} px-4 flex items-center justify-center gap-2 font-semibold ${textSize} transition-colors text-center`}>
          <CalendarCheck className="w-5 h-5 shrink-0" /> Book your free strategy session
        </div>
      </a>
      {/* Secondary — ROI Engine */}
      <a href={roiUrl} target="_blank" rel="noopener noreferrer">
        <div className={`w-full border-2 border-[#770142] text-[#770142] hover:bg-[#770142]/5 rounded-xl ${py} px-4 flex items-center justify-center gap-2 font-semibold ${textSize} transition-colors text-center`}>
          <TrendingUp className="w-5 h-5 shrink-0" /> Estimate the impact of a campaign with SkillfulMeans
        </div>
      </a>
    </div>
  );
}