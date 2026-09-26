import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QR_DESTINATIONS } from '@/lib/qrLinks';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png';

// How long the welcome screen holds before forwarding. Long enough to read the
// line, short enough that nobody standing at a booth wonders if it's stuck.
const HOLD_MS = 2600;

/**
 * Conference QR landing — /Scan?to=<key>.
 *
 * Every QR code from Admin Tools points here. Shows the SkillfulMeans logo,
 * "Mental Fitness Campaigns" and "Catch stress before it costs you", then
 * forwards to the tool (see src/lib/qrLinks.js). Tapping anywhere skips the
 * wait. Unknown or missing keys fall back to the Quick Builder so a mistyped
 * or old code never lands on a dead end.
 */
export default function Scan() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const key = (params.get('to') || '').toLowerCase();
  const dest = QR_DESTINATIONS[key] || QR_DESTINATIONS.quickbuilder;
  const [visible, setVisible] = useState(false);

  const go = useMemo(() => () => {
    if (/^https?:\/\//i.test(dest.url)) window.location.replace(dest.url);
    else navigate(dest.url, { replace: true });
  }, [dest, navigate]);

  useEffect(() => {
    document.title = 'SkillfulMeans — Mental Fitness Campaigns';
    const fade = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(go, HOLD_MS);
    return () => { cancelAnimationFrame(fade); clearTimeout(t); };
  }, [go]);

  return (
    <button
      type="button"
      onClick={go}
      aria-label={`Continue to ${dest.label}`}
      className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center justify-center text-center px-8
                 bg-[#013f7c] text-white cursor-pointer select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className={`flex flex-col items-center transition-all duration-700 ease-out ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <img src={LOGO_URL} alt="SkillfulMeans" className="h-20 sm:h-24 w-auto mb-8" />
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
          Mental Fitness Campaigns
        </h1>
        <div className="w-12 h-1 rounded-full bg-brand-lime my-6" />
        <p className="text-xl sm:text-2xl italic text-white/90 leading-snug max-w-md">
          “Catch stress before it costs you”
        </p>
      </div>

      <div
        className={`absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3 transition-opacity duration-700 delay-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ bottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="w-40 h-1 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white/80 rounded-full"
            style={{ width: visible ? '100%' : '0%', transition: `width ${HOLD_MS}ms linear` }}
          />
        </div>
        <p className="text-sm text-white/60">Opening {dest.label}… tap to continue</p>
      </div>
    </button>
  );
}
