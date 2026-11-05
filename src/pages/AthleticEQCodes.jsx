import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { aeqScanUrl } from '@/lib/athleticEqQr';

const GREEN = '#264d44';
const PEOPLE = {
  william: { tab: 'William', name: 'William Jackson, Psy.D.' },
  trevon: { tab: 'Trevon', name: 'Trevon Bryant, M.S.' },
  website: { tab: 'Website', name: 'Scan to learn more' },
};

/**
 * Hold-up-your-phone page: /AthleticEQCodes?who=william|trevon|website.
 * Public so William and Trevon can open it without signing in. It only shows
 * the QR code; scanning goes to /AthleticEQ, which collects the lead.
 */
export default function AthleticEQCodes() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get('who') || '').toLowerCase();
  const who = PEOPLE[raw] ? raw : 'william';

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `Athletic EQ QR: ${PEOPLE[who].tab}`;
    return () => { document.title = prevTitle; };
  }, [who]);

  // Keep the screen awake while the code is being scanned, where the phone allows it.
  useEffect(() => {
    let lock = null;
    let released = false;
    const request = async () => {
      try {
        const next = await navigator.wakeLock?.request('screen');
        if (released) next?.release();
        else lock = next;
      } catch { /* not supported or denied: the code still shows */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.();
    };
  }, []);

  return (
    <div
      className="min-h-[100dvh] w-full bg-white flex flex-col items-center justify-between px-4 text-center"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-1 rounded-full bg-gray-100 p-1" role="tablist" aria-label="Choose a code">
        {Object.entries(PEOPLE).map(([key, p]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === who}
            onClick={() => setParams({ who: key }, { replace: true })}
            className="min-h-11 px-4 rounded-full text-sm font-semibold"
            style={key === who ? { backgroundColor: GREEN, color: '#fff' } : { color: '#4b5563' }}
          >
            {p.tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center">
        <h1 className="text-3xl font-bold" style={{ color: GREEN }}>Athletic EQ</h1>
        <p className="text-base text-gray-600 mt-1 mb-5">{PEOPLE[who].name}</p>
        <QRCodeSVG
          value={aeqScanUrl(who)}
          level="M"
          marginSize={2}
          fgColor={GREEN}
          style={{ width: 'min(88vw, 60vh, 520px)', height: 'min(88vw, 60vh, 520px)' }}
        />
      </div>

      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#B9593A' }}>
        Small steps, great distances.
      </p>
    </div>
  );
}
