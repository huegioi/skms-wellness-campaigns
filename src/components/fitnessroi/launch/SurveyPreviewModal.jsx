import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ClipboardList, ShieldCheck } from 'lucide-react';
import { INSTRUMENTS } from '@/components/assessments/instrumentDefs';

const SURVEY_STEPS = ['who5', 'pss4', 'uwes3', 'ucla3'];

export default function SurveyPreviewModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left p-4 rounded-2xl border-2 border-mf-rule hover:border-mf-plum transition-colors">
          <ClipboardList className="w-5 h-5 text-mf-plum shrink-0" />
          <div>
            <p className="text-sm font-semibold text-mf-ink">See what your team will answer</p>
            <p className="text-xs text-mf-ink-2">4 short sections, ~3 minutes total</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What your team will see</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-mf-plum/5 rounded-xl p-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-mf-plum shrink-0" />
            <p className="text-xs text-mf-ink-2">Privacy banner: "100% anonymous — no name or email collected"</p>
          </div>
          {SURVEY_STEPS.map(key => {
            const inst = INSTRUMENTS[key];
            return (
              <div key={key} className="border border-mf-rule rounded-xl p-4">
                <p className="text-sm font-bold text-mf-plum">{inst.label} — {inst.subtitle}</p>
                {inst.preamble && <p className="text-xs text-mf-ink-2 mt-0.5 mb-2">{inst.preamble}</p>}
                <div className="space-y-1.5">
                  {inst.questions.map(q => (
                    <p key={q.key} className="text-xs text-mf-ink-2">• {q.text}</p>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {inst.scale.map(s => (
                    <span key={s.value} className="text-[10px] bg-mf-cream text-mf-ink-2 px-1.5 py-0.5 rounded">{s.label}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}