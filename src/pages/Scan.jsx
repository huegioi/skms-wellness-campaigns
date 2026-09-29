import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
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
const HOLD_AFTER_MS = 900;  // pause on the last item before the form appears
const TOTAL_MS = INTRO_MS + ITEMS.length * STEP_MS + HOLD_AFTER_MS;

// Remembers the visitor on this phone, so scanning a second code at the same
// booth doesn't ask again — the scan is still recorded, silently.
const STORE_KEY = 'skms_scan_contact';
const readStored = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
};
const writeStored = (v) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* private mode — fine */ }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Conference QR landing — /Scan?to=<key>.
 *
 * Every QR code from Admin Tools points here. Shows the white SkillfulMeans
 * logo, "Mental Fitness Campaigns", a cycling list of what we offer, and
 * "Catch stress before it costs you". Then it asks for name + email
 * (optional — "Skip" goes straight through) and forwards to the tool (see
 * src/lib/qrLinks.js). Details land as a ScanLead in the Dashboard Review
 * Queue via submitScanLead; nothing is filed or emailed automatically.
 *
 * Tapping the intro jumps to the form. Unknown or missing keys fall back to
 * the Quick Builder so an old code never dead-ends.
 */
export default function Scan() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const rawKey = (params.get('to') || '').toLowerCase();
  const key = QR_DESTINATIONS[rawKey] ? rawKey : 'quickbuilder';
  const dest = QR_DESTINATIONS[key];

  const [stored] = useState(readStored);
  const [visible, setVisible] = useState(false);
  const [tick, setTick] = useState(-1);          // cycling index, keeps looping
  const [stage, setStage] = useState('intro');   // intro → form
  const [name, setName] = useState(stored?.name || '');
  const [email, setEmail] = useState(stored?.email || '');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const leaving = useRef(false);

  const go = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (/^https?:\/\//i.test(dest.url)) window.location.replace(dest.url);
    else navigate(dest.url, { replace: true });
  }, [dest, navigate]);

  // Returning visitor on this phone: record the scan quietly and behave like
  // the original welcome screen (animate, then straight to the tool).
  const returning = Boolean(stored?.email);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'SkillfulMeans — Mental Fitness Campaigns';
    // Timers, not requestAnimationFrame: rAF never fires in a background tab
    // (e.g. a phone that opened the link behind the camera app).
    const timers = [setTimeout(() => setVisible(true), 30)];
    timers.push(setTimeout(() => setTick(0), INTRO_MS));
    const loop = setInterval(() => setTick(t => t + 1), STEP_MS);
    timers.push(setTimeout(() => (returning ? go() : setStage('form')), TOTAL_MS));
    if (returning) {
      base44.functions.invoke('submitScanLead', {
        name: stored.name, email: stored.email, source_key: key,
      }).catch(() => {});
    }
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
      document.title = prevTitle;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = tick < 0 ? -1 : tick % ITEMS.length;

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!EMAIL_RE.test(em)) { setError('Please enter a valid email, or tap Skip.'); return; }
    setError('');
    setSending(true);
    writeStored({ name: name.trim(), email: em });
    try {
      await base44.functions.invoke('submitScanLead', { name: name.trim(), email: em, source_key: key });
    } catch (err) {
      // Never strand someone at a booth over a network hiccup — let them
      // through; only a validation reply keeps them here.
      if (err?.response?.status === 400) {
        setSending(false);
        setError(err?.response?.data?.error || 'Please check your email.');
        return;
      }
    }
    go();
  };

  const fade = `transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`;
  const showForm = stage === 'form';

  return (
    <div
      onClick={() => { if (stage === 'intro') (returning ? go() : setStage('form')); }}
      className={`min-h-[100dvh] w-full flex flex-col items-center text-center px-6 bg-[#013f7c] text-white select-none
                  ${showForm ? 'justify-start pt-10 pb-10' : 'justify-center cursor-pointer'}`}
      style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
    >
      <img
        src={SKMS_LOGO_WHITE}
        alt="SkillfulMeans"
        className={`w-auto transition-all duration-500 ${showForm ? 'h-14 mb-5' : 'h-20 sm:h-24 mb-7'} ${fade}`}
      />

      <h1 className={`font-bold tracking-tight leading-tight transition-all duration-500 ${showForm ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-5xl'} ${fade}`}>
        Mental Fitness Campaigns
      </h1>

      <div className={`w-11 h-1 rounded-full bg-brand-lime ${showForm ? 'my-4' : 'my-6'} ${fade}`} />

      {/* Cycling list — slides up in, then up and out; keeps looping */}
      <div className={`relative h-9 w-full max-w-md overflow-hidden ${fade}`} aria-live="polite">
        {ITEMS.map((item, i) => {
          const prev = active < 0 ? -2 : (active - 1 + ITEMS.length) % ITEMS.length;
          return (
            <span
              key={item}
              className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-bold text-brand-lime"
              style={{
                opacity: i === active ? 1 : 0,
                transform: `translateY(${i === active ? '0' : i === prev ? '-100%' : '100%'})`,
                transition: i === active || i === prev
                  ? 'opacity .35s ease, transform .45s cubic-bezier(.2,.8,.2,1)'
                  : 'none',
              }}
            >
              {item}
            </span>
          );
        })}
      </div>
      <div className={`flex gap-1.5 mt-3 ${fade}`} aria-hidden>
        {ITEMS.map((item, i) => (
          <span
            key={item}
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: i === active ? '#eaf995' : 'rgba(255,255,255,.3)',
              transform: i === active ? 'scale(1.3)' : 'none',
            }}
          />
        ))}
      </div>

      <p className={`italic text-white/90 leading-snug max-w-xs sm:max-w-md delay-200 ${showForm ? 'text-base sm:text-xl mt-5' : 'text-lg sm:text-2xl mt-7'} ${fade}`}>
        “Catch stress before it costs you”
      </p>

      {showForm ? (
        <form
          onSubmit={submit}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm mt-7 bg-white text-left text-gray-800 rounded-2xl p-5 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <p className="text-base font-bold text-[#013f7c]">Stay in touch</p>
          <p className="text-sm text-gray-500 mt-0.5 mb-4">
            Leave your name and email and we'll follow up personally. Then we'll open {dest.label}.
          </p>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="scan-name">Name</label>
          <input
            id="scan-name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Jane Smith"
            className="w-full h-12 rounded-lg border border-gray-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#013f7c]/40"
          />
          <label className="block text-xs font-medium text-gray-600 mb-1 mt-3" htmlFor="scan-email">Email</label>
          <input
            id="scan-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="jane@company.com"
            className="w-full h-12 rounded-lg border border-gray-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#013f7c]/40"
          />
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full h-12 mt-4 rounded-lg bg-[#013f7c] text-white font-semibold text-base disabled:opacity-60"
          >
            {sending ? 'Sending…' : `Continue to ${dest.label}`}
          </button>
          <button
            type="button"
            onClick={go}
            className="w-full h-11 mt-1 text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
        </form>
      ) : (
        <div
          className={`fixed left-0 right-0 flex flex-col items-center gap-3 transition-opacity duration-700 delay-300 ${
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
          <p className="text-sm text-white/60">
            {returning ? `Opening ${dest.label}… tap to continue` : 'Tap to continue'}
          </p>
        </div>
      )}
    </div>
  );
}
