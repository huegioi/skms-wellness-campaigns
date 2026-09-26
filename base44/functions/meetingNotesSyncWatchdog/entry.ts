import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Watchdog for the Google Meet notes/transcripts → client & partner Activity tab sync.
//
// Why this exists: on 2026-09-02 the Google Drive connector was revoked, the
// "Auto-Capture Meeting Artifacts" automation failed, and Base44 switched it OFF.
// Drive was reconnected the same day but the automation stayed off, so no meeting
// notes reached any Activity tab for 3.5 weeks and nobody noticed.
//
// Runs hourly (workflow "Meeting Notes Sync Watchdog (Hourly)") and on demand from
// the in-app banner. It checks:
//   1. the Auto-Capture automation is Active, not failing, and has run recently
//   2. the Google Drive connector works (reads the Gemini notes docs)
//   3. the Google Calendar connector works (finds the meetings)
// Result is stored on IntegrationHealth (key 'meeting_notes'), which drives the
// warning banner in Layout. William is emailed when a problem starts, again every
// 24 h while it lasts, and once when it clears.
//
// False-alarm guard: "hard" problems (automation switched off / missing, or Google
// rejecting the connection's sign-in) raise the warning at once. "Soft" ones (automation
// hasn't run lately, recent runs failed, Google timing out) must show up on TWO checks
// in a row first — the very first run of this watchdog hit a one-off Drive HTTP 524.
//
// Actions:
//   { action: 'status' }  → return the stored result + fix steps (any signed-in user)
//   { action: 'check' }   → run the checks now (default; scheduled runs pass automation: true)
//
// Never returns a 5xx on a failed check — a watchdog that errors gets auto-disabled
// by Base44 just like the thing it is watching.

const KEY = 'meeting_notes';
const LABEL = 'Meeting notes → client & partner Activity tabs';
const ALERT_TO = 'william@skillfulmeans.life';
const WORKFLOW_NAME = 'Auto-Capture Meeting Artifacts';
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;      // automation runs every 30 min
const REALERT_EVERY_MS = 24 * 60 * 60 * 1000;   // remind once a day while broken

const PROBLEM_TEXT = {
  automation_off: `The "${WORKFLOW_NAME}" automation is switched OFF. Base44 turns an automation off by itself after it fails several times in a row.`,
  automation_failing: `The "${WORKFLOW_NAME}" automation is failing — its recent runs ended in errors.`,
  stale: `The "${WORKFLOW_NAME}" automation has not run in over 2 hours (it should run every 30 minutes).`,
  drive_disconnected: 'The app has lost its Google Drive connection, so it cannot open the "Notes by Gemini" docs.',
  calendar_disconnected: 'The app has lost its Google Calendar connection, so it cannot find which meetings ended.',
};

function fixSteps(problems: string[]): string[] {
  const steps: string[] = [];
  if (problems.includes('drive_disconnected')) {
    steps.push('Reconnect Google Drive: open the Base44 editor → Integrations (Connectors) → Google Drive → Reconnect, signing in as william@skillfulmeans.life (read-only access is enough).');
  }
  if (problems.includes('calendar_disconnected')) {
    steps.push('Reconnect Google Calendar: Base44 editor → Integrations (Connectors) → Google Calendar → Reconnect, signing in as admin@skillfulmeans.life.');
  }
  if (problems.includes('automation_failing')) {
    steps.push(`Open Base44 editor → Automations → "${WORKFLOW_NAME}" → Logs to read the error. A "No active connection" error means a connection above needs reconnecting.`);
  }
  // Always make sure the automation is on — Base44 leaves it off even after the cause is fixed.
  steps.push(`Turn the automation back on: Base44 editor → Automations → "${WORKFLOW_NAME}" → switch to Active.`);
  steps.push('Catch up the meetings that were missed: Base44 editor → Code → Functions → processMeetingArtifacts → Test, with the payload {"backfill_days": 30}. It skips anything already captured, so it is safe to run.');
  steps.push('Click "Recheck now" on this banner (or wait for the hourly check). The warning clears itself once everything is healthy.');
  steps.push('Or ask Claude in the Base 44 SKMS App project: "meeting notes sync is down — fix it and backfill".');
  return steps;
}

const fmtET = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
    }) + ' ET';
  } catch { return iso; }
};

async function getWorkflowState() {
  // Platform API, same credential pattern checkQuickBooksHealth uses.
  const appId = Deno.env.get('BASE44_APP_ID');
  const apiKey = Deno.env.get('BASE44_API_KEY');
  if (!appId || !apiKey) return { available: false, reason: 'BASE44_APP_ID / BASE44_API_KEY not set' };
  const attempts = [
    { host: 'https://app.base44.com', headers: { api_key: apiKey } },
    { host: 'https://app.base44.com', headers: { 'x-api-key': apiKey } },
    { host: 'https://api.base44.com', headers: { 'x-api-key': apiKey } },
    { host: 'https://api.base44.com', headers: { api_key: apiKey } },
  ];
  const errors: string[] = [];
  for (const a of attempts) {
    try {
      const res = await fetch(`${a.host}/api/apps/${appId}/workflows`, { headers: a.headers as HeadersInit });
      if (!res.ok) { errors.push(`${a.host} ${Object.keys(a.headers)[0]} → ${res.status}`); continue; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.result || data.items || data.workflows || []);
      const wf = list.find((w: any) => w.name === WORKFLOW_NAME || w.file_key === WORKFLOW_NAME);
      if (!wf) return { available: true, found: false };
      return {
        available: true, found: true,
        status: wf.status, status_reason: wf.status_reason,
        last_run_at: wf.last_run_at, last_run_status: wf.last_run_status,
        consecutive_failures: wf.consecutive_failures || 0,
      };
    } catch (e) {
      errors.push(`${a.host} → ${(e as Error).message}`);
    }
  }
  return { available: false, reason: errors.join('; ') };
}

// Returns { ok, hard, detail }. hard=true means the connection itself is gone or
// rejected (no active connection, no token, 401/403); anything else (timeouts, 5xx)
// is treated as a soft, possibly-transient failure.
async function probeConnector(base44: any, type: string, testUrl: string) {
  let accessToken: string | undefined;
  try {
    ({ accessToken } = await base44.asServiceRole.connectors.getConnection(type));
  } catch (e) {
    return { ok: false, hard: true, detail: (e as Error).message };
  }
  if (!accessToken) return { ok: false, hard: true, detail: 'no access token' };

  let lastDetail = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(testUrl, { headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal });
      if (res.ok) return { ok: true, hard: false, detail: '' };
      if (res.status === 401 || res.status === 403) {
        return { ok: false, hard: true, detail: `Google rejected the connection (HTTP ${res.status})` };
      }
      lastDetail = `Google API HTTP ${res.status}`;
    } catch (e) {
      lastDetail = (e as Error).name === 'AbortError' ? 'Google API timed out' : (e as Error).message;
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, hard: false, detail: lastDetail };
}

async function loadRow(base44: any) {
  const rows = await base44.asServiceRole.entities.IntegrationHealth.filter({ key: KEY }, '-updated_date', 1);
  return rows[0] || null;
}

async function sendEmail(base44: any, subject: string, html: string) {
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'SkillfulMeans CRM', to: ALERT_TO, subject, body: html,
    });
    return true;
  } catch (e) {
    console.error('Alert email failed:', (e as Error).message);
    return false;
  }
}

function problemEmail(problems: string[], details: string, since: string, reminder: boolean) {
  const items = problems.map(p => `<li>${PROBLEM_TEXT[p as keyof typeof PROBLEM_TEXT] || p}</li>`).join('');
  const steps = fixSteps(problems).map(s => `<li style="margin-bottom:6px">${s}</li>`).join('');
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;color:#1f2937">
      <h2 style="color:#b45309;margin-bottom:4px">⚠️ Meeting notes ${reminder ? 'are still not' : 'have stopped'} syncing</h2>
      <p style="margin-top:0;color:#6b7280">Problem started ${fmtET(since)}</p>
      <p>Google Meet notes and transcripts are <strong>not</strong> reaching client and referral-partner Activity tabs in the SKMS app.</p>
      <p><strong>What's wrong:</strong></p>
      <ul>${items}</ul>
      ${details ? `<p style="color:#6b7280;font-size:13px">Technical detail: ${details}</p>` : ''}
      <p><strong>How to fix it:</strong></p>
      <ol>${steps}</ol>
      <p style="color:#6b7280;font-size:13px">The same warning and steps are showing as a banner at the top of the app. ${reminder ? 'You will get one reminder a day until it is fixed.' : 'You will get a reminder each day until it is fixed, and a note when it clears.'}</p>
    </div>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let body: any = {};
  try { body = await req.clone().json(); } catch { /* no body */ }
  const action = body?.action || 'check';

  let user: any = null;
  try { user = await base44.auth.me(); } catch { /* headless */ }

  try {
    if (action === 'status') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const row = await loadRow(base44);
      const problems = row?.problems || [];
      return Response.json({
        key: KEY, label: LABEL,
        status: row?.status || 'unknown',
        problems,
        problem_text: problems.map((p: string) => PROBLEM_TEXT[p as keyof typeof PROBLEM_TEXT] || p),
        fix_steps: row?.status === 'failing' ? fixSteps(problems) : [],
        incident_started_at: row?.incident_started_at || null,
        last_checked_at: row?.last_checked_at || null,
        last_alert_sent_at: row?.last_alert_sent_at || null,
        alert_to: ALERT_TO,
        is_admin: user.role === 'admin',
      });
    }

    // action === 'check' — scheduled (automation flag) or any signed-in team user
    if (!body?.automation && !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const problems: string[] = [];
    const details: string[] = [];
    let hard = false; // any problem that should warn immediately

    // 1. Automation state
    const wf: any = await getWorkflowState();
    if (wf.available && wf.found) {
      if (wf.status !== 'active') {
        hard = true;
        problems.push('automation_off');
        details.push(`automation status=${wf.status}${wf.status_reason ? ` (${wf.status_reason})` : ''}`);
      } else {
        if (wf.consecutive_failures >= 2 || wf.last_run_status === 'failed') {
          problems.push('automation_failing');
          details.push(`last run ${wf.last_run_status}, ${wf.consecutive_failures} failures in a row`);
        }
        const last = wf.last_run_at ? new Date(wf.last_run_at).getTime() : 0;
        if (!last || now.getTime() - last > STALE_AFTER_MS) {
          problems.push('stale');
          details.push(`last run ${wf.last_run_at || 'never'}`);
        }
      }
    } else if (wf.available && !wf.found) {
      hard = true;
      problems.push('automation_off');
      details.push('automation not found (deleted or renamed?)');
    } else {
      console.warn('Workflow status check unavailable:', wf.reason);
    }

    // 2 + 3. Google connectors — a real API call, not just "is a token present"
    const drive = await probeConnector(base44, 'googledrive', 'https://www.googleapis.com/drive/v3/about?fields=user');
    if (!drive.ok) { if (drive.hard) hard = true; problems.push('drive_disconnected'); details.push(`Drive: ${drive.detail}`); }
    const cal = await probeConnector(base44, 'googlecalendar', 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1');
    if (!cal.ok) { if (cal.hard) hard = true; problems.push('calendar_disconnected'); details.push(`Calendar: ${cal.detail}`); }

    // Persist + alert
    const row = await loadRow(base44);
    const wasFailing = row?.status === 'failing';
    const badChecks = problems.length > 0 ? (row?.consecutive_bad_checks || 0) + 1 : 0;
    // Warn on a hard problem at once, on a soft one only when it repeats.
    const failing = problems.length > 0 && (hard || badChecks >= 2 || wasFailing);
    const update: any = {
      key: KEY, label: LABEL,
      status: failing ? 'failing' : 'ok',
      problems,
      problem_detail: details.join(' | '),
      consecutive_bad_checks: badChecks,
      last_checked_at: nowIso,
      workflow_status: wf.available ? (wf.found ? wf.status : 'missing') : 'unknown',
      workflow_last_run_at: wf.last_run_at || null,
      workflow_last_run_status: wf.last_run_status || null,
    };

    let emailed: string | null = null;
    if (failing) {
      const since = wasFailing && row?.incident_started_at ? row.incident_started_at : nowIso;
      update.incident_started_at = since;
      const lastAlert = wasFailing && row?.last_alert_sent_at ? new Date(row.last_alert_sent_at).getTime() : 0;
      if (!wasFailing || !lastAlert || now.getTime() - lastAlert > REALERT_EVERY_MS) {
        const reminder = wasFailing && !!lastAlert;
        const ok = await sendEmail(
          base44,
          reminder ? '⚠️ Still broken: meeting notes not syncing to Activity tabs' : '⚠️ Meeting notes stopped syncing to client & partner Activity tabs',
          problemEmail(problems, details.join(' | '), since, reminder),
        );
        if (ok) { update.last_alert_sent_at = nowIso; emailed = reminder ? 'reminder' : 'alert'; }
      }
    } else if (problems.length === 0) {
      update.last_ok_at = nowIso;
      if (wasFailing) {
        update.resolved_at = nowIso;
        update.incident_started_at = null;
        update.last_alert_sent_at = null;
        const ok = await sendEmail(
          base44,
          '✅ Meeting notes are syncing again',
          `<div style="font-family:Arial,sans-serif;max-width:620px;color:#1f2937">
            <h2 style="color:#15803d">✅ Meeting notes are syncing again</h2>
            <p>The problem that started ${fmtET(row?.incident_started_at)} has cleared. Google Meet notes and transcripts are reaching client and partner Activity tabs again.</p>
            <p>If you haven't already, catch up the missed meetings: Base44 editor → Code → Functions → processMeetingArtifacts → Test with <code>{"backfill_days": 30}</code>.</p>
          </div>`,
        );
        if (ok) emailed = 'resolved';
      }
    }

    if (row) await base44.asServiceRole.entities.IntegrationHealth.update(row.id, update);
    else await base44.asServiceRole.entities.IntegrationHealth.create(update);

    return Response.json({
      status: update.status, problems, details, emailed, consecutive_bad_checks: badChecks,
      workflow_check: wf.available ? 'ok' : `unavailable: ${wf.reason}`,
    });
  } catch (error) {
    console.error('meetingNotesSyncWatchdog error:', error);
    // 200 on purpose — see header comment.
    return Response.json({ status: 'check_error', error: (error as Error).message });
  }
});
