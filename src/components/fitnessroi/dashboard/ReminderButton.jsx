import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Loader2, Clock, CheckCircle } from 'lucide-react';

export default function ReminderButton({ magicKey, reminderSentAt }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const lastReminder = reminderSentAt && reminderSentAt.length > 0
    ? new Date(reminderSentAt[reminderSentAt.length - 1]) : null;
  const hoursSince = lastReminder ? (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60) : 49;
  const canSend = hoursSince >= 48;

  let nextText = '';
  if (!canSend && lastReminder) {
    const hoursLeft = Math.ceil(48 - hoursSince);
    nextText = `Next reminder in ${hoursLeft}h`;
  }

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendJourneyReminder', { magic_key: magicKey });
      if (res.data?.error === 'rate_limited') return;
      if (res.data?.error) return;
      setResult(res.data);
    } catch {}
    setSending(false);
  };

  if (result) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-4 shadow-sm text-center">
        <CheckCircle className="w-5 h-5 text-[#0f766e] mx-auto mb-1" />
        <p className="text-sm font-semibold text-[#0f766e]">Reminder sent to {result.sent_count} {result.sent_count === 1 ? 'person' : 'people'}</p>
        {result.suppressed_count > 0 && <p className="text-xs text-stone-400 mt-1">{result.suppressed_count} skipped (unsubscribed)</p>}
      </div>
    );
  }

  return (
    <button onClick={handleSend} disabled={!canSend || sending}
      className="w-full bg-white border-2 border-[#0f766e] text-[#0f766e] rounded-2xl py-3 font-semibold text-sm hover:bg-[#0f766e] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
      {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
       : !canSend ? <><Clock className="w-4 h-4" /> {nextText}</>
       : <><Bell className="w-4 h-4" /> Send a reminder</>}
    </button>
  );
}