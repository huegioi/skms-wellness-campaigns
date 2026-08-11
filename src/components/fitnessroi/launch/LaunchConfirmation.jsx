import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function LaunchConfirmation({ magicKey }) {
  return (
    <div className="mf-card border-l-4 border-l-mf-plum p-8 text-center shadow-sm">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-mf-plum/10">
        <CheckCircle className="w-8 h-8 text-mf-plum" />
      </div>
      <h2 className="text-xl font-bold text-mf-plum mb-2">You're live!</h2>
      <p className="text-sm text-mf-ink-2 mb-1">Your team survey is active. Share the link with your team — they can take the 3-minute anonymous survey anytime.</p>
      <p className="text-xs text-mf-ink-3 mb-5">We'll email you a reminder with your response count on day 3 and day 7.</p>
      <Link
        to={`/FitnessRoi/dashboard?k=${magicKey}`}
        className="inline-flex items-center gap-2 bg-mf-plum text-white rounded-full px-6 py-3 font-semibold text-sm hover:bg-mf-plum-dark transition-colors"
      >
        Track responses on your dashboard <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}