import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';

// IMPORTANT: unsubscribing must require a deliberate click.
//
// This page previously called submitSurveyUnsubscribe from a useEffect on mount,
// so merely LOADING the URL opted someone out. Corporate mail gateways
// (Microsoft Safe Links, Mimecast, Proofpoint) pre-fetch every link in an inbound
// message to scan it for malware — that fetch rendered this page, fired the
// effect, and silently unsubscribed recipients who had never opened the email.
// On one send, 8 of 16 recipients at a single company were opted out within 26
// seconds of delivery, the buyer among them.
//
// Scanners follow links; they do not click buttons. Gating the mutation behind an
// onClick is what makes the difference. Never move this back into an effect.
export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState(email ? 'confirm' : 'error'); // confirm | working | done | error

  const handleUnsubscribe = async () => {
    setStatus('working');
    try {
      await base44.functions.invoke('submitSurveyUnsubscribe', { email });
      setStatus('done');
    } catch (e) {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <img
          src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
          alt="SkillfulMeans"
          className="h-10 mx-auto mb-6"
        />
        {status === 'confirm' && (
          <>
            <MailX className="w-16 h-16 text-[#264d44] mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-800 mb-2">Unsubscribe from survey emails?</h1>
            <p className="text-gray-600 mb-6">
              <span className="font-medium">{email}</span> will stop receiving session feedback and
              wellbeing survey emails from SkillfulMeans.
            </p>
            <button
              onClick={handleUnsubscribe}
              className="w-full bg-[#264d44] text-white font-semibold rounded-lg px-6 py-3 hover:opacity-90 transition-opacity"
            >
              Yes, unsubscribe me
            </button>
            <p className="text-xs text-gray-400 mt-4">
              Nothing changes unless you press the button above.
            </p>
          </>
        )}
        {status === 'working' && <Loader2 className="w-12 h-12 text-[#264d44] mx-auto mb-4 animate-spin" />}
        {status === 'done' && <CheckCircle2 className="w-16 h-16 text-[#264d44] mx-auto mb-4" />}
        {status === 'error' && <MailX className="w-16 h-16 text-red-400 mx-auto mb-4" />}
        {status === 'working' && <p className="text-gray-600">Processing your unsubscribe…</p>}
        {status === 'done' && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-2">You're unsubscribed</h1>
            <p className="text-gray-600">{email} will no longer receive survey emails from SkillfulMeans.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-600">We couldn't process your unsubscribe. Please contact admin@skillfulmeans.life.</p>
          </>
        )}
      </div>
    </div>
  );
}