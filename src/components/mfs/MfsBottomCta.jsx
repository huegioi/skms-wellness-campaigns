import React from 'react';
import { CalendarCheck, TrendingUp } from 'lucide-react';

const CALENDLY_URL = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';
const ROI_ENGINE_BASE = 'https://skillfulmeans-roi-production.up.railway.app/';

export default function MfsBottomCta({ employeeCount }) {
  const roiUrl = ROI_ENGINE_BASE + (employeeCount ? `?headcount=${encodeURIComponent(employeeCount)}` : '');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {/* Primary — Book session card (matches PDF report treatment) */}
      <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="block">
        <div className="w-full bg-[#770142] hover:bg-[#5a0132] text-white rounded-xl p-5 transition-colors min-h-[180px] flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-base">Book your free strategy session</h3>
          </div>
          <p className="text-xs text-white/80 leading-relaxed">
            A 30-minute conversation with our team — we'll walk through your results together, what they suggest about your organization, and what a realistic path forward could look like. No obligation, no prepared pitch. Prefer to go through your benefits broker? They're welcome to reach out on your behalf — either way, <span className="underline">admin@skillfulmeans.life</span> reaches us directly.
          </p>
        </div>
      </a>
      {/* Secondary — ROI Engine card */}
      <a href={roiUrl} target="_blank" rel="noopener noreferrer" className="block">
        <div className="w-full border-2 border-[#770142] text-[#770142] hover:bg-[#770142]/5 rounded-xl p-5 transition-colors min-h-[180px] flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-base">Estimate the impact of a campaign</h3>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Model your team's ROI with our calculator — see projected savings across medical claims, absenteeism, presenteeism, and turnover based on your workforce profile.
          </p>
        </div>
      </a>
    </div>
  );
}