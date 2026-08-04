import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState('loading'); // loading | done | error

  useEffect(() => {
    if (!email) { setStatus('error'); return; }
    (async () => {
      try {
        await base44.functions.invoke('submitSurveyUnsubscribe', { email });
        setStatus('done');
      } catch (e) {
        setStatus('error');
      }
    })();
  }, [email]);

  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <img
          src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
          alt="SkillfulMeans"
          className="h-10 mx-auto mb-6"
        />
        {status === 'loading' && <Loader2 className="w-12 h-12 text-[#264d44] mx-auto mb-4 animate-spin" />}
        {status === 'done' && <CheckCircle2 className="w-16 h-16 text-[#264d44] mx-auto mb-4" />}
        {status === 'error' && <MailX className="w-16 h-16 text-red-400 mx-auto mb-4" />}
        {status === 'loading' && <p className="text-gray-600">Processing your unsubscribe…</p>}
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