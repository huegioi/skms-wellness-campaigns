import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // List all automations and filter for the daily Kajabi sync
    const allAutomations = await fetch(`${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/v1/automations`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_TOKEN')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!allAutomations.ok) {
      throw new Error('Failed to list automations');
    }

    const data = await allAutomations.json();
    const kajabiSyncAutomations = (data.automations || []).filter(a => 
      a.function_name === 'appendNewKajabiContacts' && a.automation_type === 'scheduled'
    );

    return Response.json(kajabiSyncAutomations);

  } catch (error) {
    console.error('List automation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});