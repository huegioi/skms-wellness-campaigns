import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Copy, Check, Mail, Loader2, Clock, CheckCircle } from 'lucide-react';

export default function DashboardControlsBar({ count, surveyUrl, magicKey, reminderSentAt }) {
  const target = 5;
  const unlocked = count >= target;

  // Copy state
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Email reminder state (mirrors ReminderButton logic)
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const lastReminder = reminderSentAt && reminderSentAt.length > 0
    ? new Date(reminderSentAt[reminderSentAt.length - 1]) : null;
  const hoursSince = lastReminder ? (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60) : 49;
  const canSend = hoursSince >= 48;

  let nextText = '';
  if (!canSend && lastReminder) {
    const hoursLeft = Math.ceil(48 - hoursSince);
    nextText = `Next in ${hoursLeft}h`;
  }

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendJourneyReminder', { magic_key: magicKey });
      if (res.data?.error === 'rate_limited') return;
      if (res.data?.error) return;
      setSent(true);
    } catch {}
    setSending(false);
  };

  return (
    <div className="mf-card border-l-4 border-l-mf-plum px-4 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Left — response count */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold text-mf-plum">
            {unlocked ? `${count} responses` : `${count} of ${target} responses`}
          </span>
          {unlocked && (
            <span className="text-[10px] text-mf-plum bg-teal-50 px-1.5 py-0.5 rounded-full font-medium">
              results unlocked
            </span>
          )}
        </div>

        {/* Middle — survey link + copy */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <div className="flex-1 min-w-0 bg-mf-cream rounded-lg px-2.5 py-1.5 border border-mf-rule">
            <p className="text-xs text-mf-ink-3 font-mono truncate">{surveyUrl}</p>
          </div>
          <button onClick={handleCopy}
            className="shrink-0 bg-white border border-mf-rule text-mf-ink rounded-lg px-2.5 py-1.5 font-medium text-xs hover:border-mf-plum hover:text-mf-plum transition-colors flex items-center gap-1">
            {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        </div>

        {/* Right — email me my link */}
        {sent ? (
          <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-mf-plum">
            <CheckCircle className="w-3.5 h-3.5" /> Sent
          </span>
        ) : (
          <button onClick={handleSend} disabled={!canSend || sending}
            className="shrink-0 bg-white border border-mf-plum text-mf-plum rounded-lg px-3 py-1.5 font-medium text-xs hover:bg-mf-plum hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
            {sending ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
             : !canSend ? <><Clock className="w-3 h-3" /> {nextText}</>
             : <><Mail className="w-3 h-3" /> Email me my link</>}
          </button>
        )}
      </div>
    </div>
  );
}