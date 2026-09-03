import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Manage the daily "Networking Events sync" automation that runs
// ingestNetworkingEvents. Mirrors createDailyKajabiSync / listDailyKajabiSync /
// toggleDailyKajabiSync in one function: { action: 'status' | 'enable' | 'disable' }.

const TEAM_EMAILS = (Deno.env.get('TEAM_EMAILS') || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || '').toLowerCase()));
const FUNCTION_NAME = 'ingestNetworkingEvents';
const AUTOMATION_NAME = 'Daily Networking Events Sync';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) return Response.json({ error: 'Unauthorized' }, { status: 403 });

    const { action = 'status' } = await req.json().catch(() => ({}));
    const apiUrl = Deno.env.get('BASE44_API_URL') || 'https://api.base44.com';
    const headers = { 'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_TOKEN')}`, 'Content-Type': 'application/json' };

    const listRes = await fetch(`${apiUrl}/v1/automations`, { headers });
    if (!listRes.ok) throw new Error(`Failed to list automations (${listRes.status})`);
    const data = await listRes.json();
    const all = (data.automations || data || []);
    let existing = all.find(a => a.function_name === FUNCTION_NAME && a.automation_type === 'scheduled') || null;

    if (action === 'enable' && !existing) {
      const createRes = await fetch(`${apiUrl}/v1/automations`, {
        method: 'POST', headers,
        body: JSON.stringify({
          automation_type: 'scheduled',
          name: AUTOMATION_NAME,
          description: 'Checks each active feed source for new networking events and archives past ones',
          function_name: FUNCTION_NAME,
          schedule_type: 'simple',
          repeat_interval: 1,
          repeat_unit: 'days',
          start_time: '06:30',
          is_active: true,
        }),
      });
      if (!createRes.ok) throw new Error(`Failed to create automation: ${await createRes.text()}`);
      existing = await createRes.json();
    } else if ((action === 'enable' || action === 'disable') && existing) {
      const patchRes = await fetch(`${apiUrl}/v1/automations/${existing.id}`, { method: 'PATCH', headers, body: JSON.stringify({ is_active: action === 'enable' }) });
      if (!patchRes.ok) throw new Error(`Failed to update automation: ${await patchRes.text()}`);
      existing = { ...existing, is_active: action === 'enable' };
    }

    return Response.json({
      exists: !!existing,
      is_active: !!existing?.is_active,
      id: existing?.id || null,
      name: existing?.name || AUTOMATION_NAME,
      schedule: existing ? `${existing.schedule_type || 'simple'} · every ${existing.repeat_interval || 1} ${existing.repeat_unit || 'days'} at ${existing.start_time || '06:30'}` : null,
      last_run: existing?.last_run_at || existing?.last_run || null,
    });
  } catch (error) {
    console.error('manageNetworkingEventsSync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
