import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Link2, Loader2, Copy, Check } from 'lucide-react';

export default function SendOptions({ magicKey, surveyUrl, onLaunched }) {
  const [emails, setEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSendEmails = async () => {
    setSending(true);
    setError('');
    try {
      const res = await base44.functions.invoke('launchTeamAssessment', {
        magic_key: magicKey,
        employee_emails: emails,
      });
      if (res.data?.error) throw new Error(res.data.error);
      onLaunched({ mode: 'email', sent_count: res.data.sent_count, suppressed_count: res.data.suppressed_count });
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    try {
      await base44.functions.invoke('launchTeamAssessment', { magic_key: magicKey });
    } catch {}
    onLaunched({ mode: 'copy' });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-5 h-5 text-[#0f766e]" />
          <h3 className="text-sm font-bold text-[#4a2040]">Email my team</h3>
        </div>
        <p className="text-xs text-stone-500 mb-3">Paste employee emails below. We'll send the invite for you.</p>
        <textarea
          value={emails}
          onChange={e => setEmails(e.target.value)}
          placeholder="jane@company.com, john@company.com..."
          rows={4}
          className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:border-[#0f766e] focus:outline-none text-sm text-stone-700 resize-none"
        />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <button
          onClick={handleSendEmails}
          disabled={!emails.trim() || sending}
          className="w-full mt-3 bg-[#0f766e] text-white rounded-full py-2.5 font-semibold text-sm hover:bg-[#0d6560] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 'Send invites'}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-5 h-5 text-[#0f766e]" />
          <h3 className="text-sm font-bold text-[#4a2040]">Or copy the link</h3>
        </div>
        <p className="text-xs text-stone-500 mb-3">Share it yourself via Slack, Teams, or any channel.</p>
        <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
          <p className="text-xs text-stone-400 font-mono break-all">{surveyUrl}</p>
        </div>
        <button
          onClick={handleCopyLink}
          className="w-full mt-3 bg-white border-2 border-[#0f766e] text-[#0f766e] rounded-full py-2.5 font-semibold text-sm hover:bg-[#0f766e] hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy link</>}
        </button>
      </div>
    </div>
  );
}