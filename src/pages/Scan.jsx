import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QR_DESTINATIONS } from '@/lib/qrLinks';
import { SKMS_LOGO_WHITE } from '@/assets/logoWhite';

// What we do, cycled one at a time under the title (William, 2026-09-26).
const ITEMS = [
  'Live Workshops',
  'Leadership Coaching',
  'Team Mental Fitness',
  'Challenges',
  'Incentives',
  'Measured Outcomes',
];
const INTRO_MS = 700;       // logo + title settle before the list starts
const STEP_MS = 700;        // each item on screen
const HOLD_AFTER_MS = 900;  // pause on the last item before forwarding
const TOTAL_MS = INTRO_MS + ITEMS.length * STEP_MS + HOLD_AFTER_MS;

/**
 * Conference QR landing — /Scan?to=<key>.
 *
 * Every QR code from Admin Tools points here. Shows the white SkillfulMeans
 * logo, "Mental Fitness Campaigns", a cycling list of what we offer, and
 * "Catch stress before it costs you", then forwards to the tool (see
 * src/lib/qrLinks.js). Tapping anywhere skips straight through. Unknown or
 * missing keys fall back to the Quick Builder so an old code never dead-ends.
 *
 * The logo is inlined (src/assets/logoWhite.js) rather than fetched, so it is
 * on screen from the first frame even on conference Wi-Fi.
 */
export default function Scan() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const key = (params.get('to') || '').toLowerCase();
  const dest = QR_DESTINATIONS[key] || QR_DESTINATIONS.quickbuilder;
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(-1);

  const go = useCallback(() => {
    if (/^https?:\/\//i.test(dest.url)) window.location.replace(dest.url);
    else navigate(dest.url, { replace: true });
  }, [dest, navigate]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'SkillfulMeans — Mental Fitness Campaigns';
    // A timer, not requestAnimationFrame: rAF never fires in a background tab
    // (e.g. a phone that opened the link behind the camera app), which left
    // the whole screen at opacity 0.
    const timers = [setTimeout(() => setVisible(true), 30)];
    ITEMS.forEach((_, i) => timers.push(setTimeout(() => setActive(i), INTRO_MS + i * STEP_MS)));
    timers.push(setTimeout(go, TOTAL_MS));
    return () => {
      timers.forEach(clearTimeout);
      document.title = prevTitle;
    };
  }, [go]);

  const fade = `transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`;

  return (
    <button
      type="button"
      onClick={go}
      aria-label={`Continue to ${dest.label}`}
      className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center justify-center text-center px-8
                 bg-[#013f7c] text-white cursor-pointer select-none"
    >
      <img src={SKMS_LOGO_WHITE} alt="SkillfulMeans" className={`h-20 sm:h-24 w-auto mb-7 ${fade}`} />

      <h1 className={`text-3xl sm:text-5xl font-bold tracking-tight leading-tight ${fade}`}>
        Mental Fitness Campaigns
      </h1>

      <div className={`w-11 h-1 rounded-full bg-brand-lime my-6 ${fade}`} />

      {/* Cycling list — each item slides up in, then up and out */}
      <div className={`relative h-9 w-full max-w-md overflow-hidden ${fade}`} aria-live="polite">
        {ITEMS.map((item, i) => (
          <span
            key={item}
            className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-bold text-brand-lime"
            style={{
              opacity: i === active ? 1 : 0,
              transform: `translateY(${i === active ? '0' : i < active ? '-100%' : '100%'})`,
              transition: 'opacity .35s ease, transform .45s cubic-bezier(.2,.8,.2,1)',
            }}
          >
            {item}
          </span>
        ))}
      </div>
      <div className={`flex gap-1.5 mt-3 ${fade}`} aria-hidden>
        {ITEMS.map((item, i) => (
          <span
            key={item}
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: i === active ? '#eaf995' : i < active ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)',
              transform: i === active ? 'scale(1.3)' : 'none',
            }}
          />
        ))}
      </div>

      <p className={`text-lg sm:text-2xl italic text-white/90 leading-snug max-w-xs sm:max-w-md mt-7 delay-200 ${fade}`}>
        “Catch stress before it costs you”
      </p>

      <div
        className={`absolute left-0 right-0 flex flex-col items-center gap-3 transition-opacity duration-700 delay-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ bottom: 'calc(2.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="w-40 h-1 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white/80 rounded-full"
            style={{ width: visible ? '100%' : '0%', transition: `width ${TOTAL_MS}ms linear` }}
          />
        </div>
        <p className="text-sm text-white/60">Opening {dest.label}… tap to continue</p>
      </div>
    </button>
  );
}
