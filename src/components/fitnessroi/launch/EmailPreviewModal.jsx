import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Mail } from 'lucide-react';

export default function EmailPreviewModal({ companyName, surveyUrl }) {
  const subject = `3 minutes, fully anonymous — help shape wellbeing at ${companyName || 'your team'}`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left p-4 rounded-2xl border-2 border-stone-200 hover:border-[#0f766e] transition-colors">
          <Mail className="w-5 h-5 text-[#0f766e] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-stone-800">See the exact email your team will get</p>
            <p className="text-xs text-stone-500">Subject + body, word for word</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Employee invite email</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-0.5">Subject</p>
            <p className="text-sm font-medium text-stone-800">{subject}</p>
          </div>
          <div className="border-t border-stone-100 pt-3">
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Body</p>
            <div className="text-sm text-stone-600 space-y-2">
              <p style={{ color: '#0f766e', fontWeight: 600 }}>3 minutes. Fully anonymous.</p>
              <p>Your leadership team is running a free team wellbeing check-in through SkillfulMeans. This is your invitation to take part.</p>
              <p>It takes about 3 minutes. Your answers are <strong>fully anonymous</strong> — no name, no email, no account. Individual responses are never shown to your employer. Only team-level aggregates are shared.</p>
              <div className="bg-[#0f766e] text-white text-center rounded-full py-2.5 font-semibold text-sm">Take the 3-minute survey</div>
              <p className="text-xs text-stone-400">Your participation is voluntary. Questions? admin@skillfulmeans.life</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}