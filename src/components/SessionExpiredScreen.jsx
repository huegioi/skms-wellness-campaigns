import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SessionExpiredScreen() {
  const handleSignIn = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f4f0e9] px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-[#013f7c] mb-2">Session expired</h1>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          Your session has expired or you are no longer signed in. Please sign in
          again to continue.
        </p>
        <button
          onClick={handleSignIn}
          className="w-full bg-[#013f7c] text-white font-semibold py-2.5 rounded-lg hover:bg-[#012a54] transition-colors"
        >
          Sign in again
        </button>
      </div>
    </div>
  );
}