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

    const { automation_id, enabled } = await req.json();

    if (!automation_id) {
      throw new Error('automation_id is required');
    }

    const response = await fetch(`${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/v1/automations/${automation_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_active: enabled })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to toggle automation: ${error}`);
    }

    return Response.json({ success: true, enabled });

  } catch (error) {
    console.error('Toggle automation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});