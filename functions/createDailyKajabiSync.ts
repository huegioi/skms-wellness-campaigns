import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create daily scheduled automation
    const response = await fetch(`${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/v1/automations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        automation_type: 'scheduled',
        name: 'Daily Kajabi Sync',
        description: 'Automatically syncs new Kajabi contacts to Google Sheets daily',
        function_name: 'appendNewKajabiContacts',
        schedule_type: 'simple',
        repeat_interval: 1,
        repeat_unit: 'days',
        start_time: '09:00',
        is_active: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create automation: ${error}`);
    }

    const automation = await response.json();
    return Response.json({ success: true, automation });

  } catch (error) {
    console.error('Create automation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});