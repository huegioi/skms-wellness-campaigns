import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function LaunchConfirmation({ magicKey, mode, sentCount, suppressedCount }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-8 text-center shadow-sm">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#0f766e]/10">
        <CheckCircle className="w-8 h-8 text-[#0f766e]" />
      </div>
      <h2 className="text-xl font-bold text-[#4a2040] mb-2">
        {mode === 'email' ? `Invites sent to ${sentCount} ${sentCount === 1 ? 'person' : 'people'}` : "Link copied — you're live!"}
      </h2>
      <p className="text-sm text-stone-500 mb-1">
        {mode === 'email'
          ? `${suppressedCount > 0 ? `${suppressedCount} email(s) were skipped (previously unsubscribed). ` : ''}Your team can now take the 3-minute anonymous survey.`
          : 'Share the link with your team. They can take the 3-minute anonymous survey anytime.'}
      </p>
      <p className="text-xs text-stone-400 mb-5">We'll never email your team again without your action.</p>
      <Link
        to={`/FitnessRoi/dashboard?k=${magicKey}`}
        className="inline-flex items-center gap-2 bg-[#0f766e] text-white rounded-full px-6 py-3 font-semibold text-sm hover:bg-[#0d6560] transition-colors"
      >
        Track responses on your dashboard <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}