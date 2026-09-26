import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Mail } from 'lucide-react';

// Big warning shown at the top of every internal page when the Google Meet
// notes → Activity tab sync is broken. State comes from the hourly watchdog
// (meetingNotesSyncWatchdog → IntegrationHealth 'meeting_notes'); the fix
// steps come from the same function, so the banner and William's alert email
// always say the same thing. Renders nothing when healthy.

const REFRESH_MS = 10 * 60 * 1000;

const fmt = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
};

export default function SyncHealthBanner() {
  const [health, setHealth] = useState(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [recheckMsg, setRecheckMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('meetingNotesSyncWatchdog', { action: 'status' });
      setHealth(res?.data || null);
    } catch {
      // Never let the health banner break a page.
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const recheck = async () => {
    setChecking(true);
    setRecheckMsg('');
    try {
      const res = await base44.functions.invoke('meetingNotesSyncWatchdog', { action: 'check' });
      await load();
      setRecheckMsg(res?.data?.status === 'ok' ? 'All clear — sync is healthy again.' : 'Still broken — see the steps below.');
    } catch {
      setRecheckMsg('Recheck failed — try again in a minute.');
    } finally {
      setChecking(false);
    }
  };

  if (!health || health.status !== 'failing') {
    return recheckMsg ? (
      <div className="bg-green-50 border-b border-green-200 text-green-800 text-sm px-4 py-2">{recheckMsg}</div>
    ) : null;
  }

  return (
    <div role="alert" className="bg-amber-50 border-b-2 border-amber-400 text-amber-900">
      <div className="px-4 py-3 flex flex-wrap items-start gap-x-3 gap-y-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[220px]">
          <p className="font-bold text-sm sm:text-base leading-snug">
            Meeting notes aren't syncing to client &amp; partner Activity tabs
          </p>
          <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
            {health.incident_started_at ? `Since ${fmt(health.incident_started_at)}. ` : ''}
            Google Meet notes and transcripts from new meetings won't appear on profiles until this is fixed.
          </p>
          {health.last_alert_sent_at && (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <Mail className="w-3 h-3" /> William was emailed {fmt(health.last_alert_sent_at)}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            How to fix {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={recheck}
            disabled={checking}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-800 text-sm font-medium hover:bg-amber-100 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking…' : 'Recheck now'}
          </button>
        </div>
      </div>

      {recheckMsg && <p className="px-4 pb-2 text-sm font-medium">{recheckMsg}</p>}

      {open && (
        <div className="px-4 pb-4 sm:pl-12 text-sm">
          {health.problem_text?.length > 0 && (
            <>
              <p className="font-semibold mb-1">What's wrong</p>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                {health.problem_text.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </>
          )}
          <p className="font-semibold mb-1">How to fix it</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            {(health.fix_steps || []).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {!health.is_admin && (
            <p className="mt-3 text-xs text-amber-700">
              These steps need William's Base44 admin access — let him know if he hasn't seen the email.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
