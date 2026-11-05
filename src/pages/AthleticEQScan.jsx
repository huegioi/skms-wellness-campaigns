import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AEQ_QR_DESTINATIONS, AEQ_ROLES } from '@/lib/athleticEqQr';

const GREEN = '#264d44';
const CORAL = '#E8866A';
const HEADING_FONT = "'Playfair Display', Georgia, serif";
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap';
const COMPETENCIES = ['Character', 'Conditioning', 'Chemistry', 'Composure', 'Commitment'];

// Remembers the visitor on this phone, so a second code doesn't ask again.
const STORE_KEY = 'aeq_scan_contact';
const readStored = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
};
const writeStored = (v) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* private mode is fine */ }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const inputClass =
  'w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-[#264d44]/40';

/**
 * Athletic EQ QR landing: /AthleticEQ?to=<key> (keys in src/lib/athleticEqQr.js).
 *
 * Asks for name, school, email and role, sends them to the Notion tracker via
 * aeqScanLead, then forwards to the code's destination. "Skip" goes straight
 * through. Unknown or missing keys go to the website so a code never dead-ends.
 */
export default function AthleticEQScan() {
  const [params] = useSearchParams();
  const rawKey = (params.get('to') || '').toLowerCase();
  const key = AEQ_QR_DESTINATIONS[rawKey] ? rawKey : 'website';
  const dest = AEQ_QR_DESTINATIONS[key];

  const [stored] = useState(readStored);
  const returning = Boolean(stored?.email);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [trap, setTrap] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const leaving = useRef(false);

  const go = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    window.location.replace(dest.url);
  }, [dest]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Athletic EQ';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    document.head.appendChild(link);
    if (returning) {
      base44.functions.invoke('aeqScanLead', { ...stored, source_key: key })
        .catch(() => {})
        .finally(go);
    }
    return () => {
      document.title = prevTitle;
      link.remove();
    };
  }, []); // once per page load: the key and stored contact don't change

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!name.trim()) { setError('Please enter your name, or tap Skip.'); return; }
    if (!EMAIL_RE.test(em)) { setError('Please enter a valid email, or tap Skip.'); return; }
    setError('');
    setSending(true);
    const contact = { name: name.trim(), school: school.trim(), email: em, role };
    writeStored(contact);
    try {
      await base44.functions.invoke('aeqScanLead', { ...contact, source_key: key, company_url: trap });
    } catch (err) {
      // Never strand someone over a network hiccup. Only a validation reply keeps them here.
      if (err?.response?.status === 400) {
        setSending(false);
        setError(err?.response?.data?.error || 'Please check your email.');
        return;
      }
    }
    go();
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center px-5 pt-8 text-center text-white"
      style={{ backgroundColor: GREEN, paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
    >
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ fontFamily: HEADING_FONT }}>
        Athletic EQ
      </h1>
      <p className="mt-2 max-w-sm text-sm sm:text-base leading-snug text-white/85">
        Workshops, curriculum and consulting for athletic programs
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-x-2 gap-y-0.5 max-w-sm text-xs font-semibold" style={{ color: CORAL }}>
        {COMPETENCIES.map((c, i) => (
          <span key={c}>{c}{i < COMPETENCIES.length - 1 ? ' ·' : ''}</span>
        ))}
      </div>

      {returning ? (
        <p className="mt-10 text-base text-white/80">Opening {dest.label}…</p>
      ) : (
        <form onSubmit={submit} className="w-full max-w-sm mt-6 rounded-2xl bg-white p-5 text-left text-gray-800 shadow-xl">
          <p className="text-lg font-bold" style={{ color: GREEN }}>Stay in touch</p>
          <p className="text-sm text-gray-500 mt-0.5 mb-3">
            Leave your details and William or Trevon will follow up personally. Then we'll open {dest.label}.
          </p>

          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="aeq-name">Name</label>
          <input id="aeq-name" value={name} onChange={e => { setName(e.target.value); setError(''); }}
            autoComplete="name" autoCapitalize="words" enterKeyHint="next" className={inputClass} />

          <label className="block text-xs font-medium text-gray-600 mb-1 mt-2.5" htmlFor="aeq-school">School or organization</label>
          <input id="aeq-school" value={school} onChange={e => setSchool(e.target.value)}
            autoComplete="organization" autoCapitalize="words" enterKeyHint="next" className={inputClass} />

          <label className="block text-xs font-medium text-gray-600 mb-1 mt-2.5" htmlFor="aeq-email">Email</label>
          <input id="aeq-email" type="email" inputMode="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            enterKeyHint="next" className={inputClass} />

          <label className="block text-xs font-medium text-gray-600 mb-1 mt-2.5" htmlFor="aeq-role">Your role</label>
          <select id="aeq-role" value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
            <option value="">Choose one</option>
            {AEQ_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Hidden from people; bots fill it in and get ignored. */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap}
            onChange={e => setTrap(e.target.value)} style={{ position: 'absolute', left: '-9999px' }} />

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          <button type="submit" disabled={sending}
            className="w-full min-h-12 mt-4 px-3 py-2 rounded-lg text-white font-semibold text-base disabled:opacity-60"
            style={{ backgroundColor: GREEN }}>
            {sending ? 'Sending…' : `Continue to ${dest.label}`}
          </button>
          <button type="button" onClick={go} className="w-full h-10 mt-1 text-sm text-gray-500 hover:text-gray-700">
            Skip for now
          </button>
        </form>
      )}

      <p className="mt-6 text-xs tracking-widest uppercase text-white/60">Small steps, great distances.</p>
    </div>
  );
}
