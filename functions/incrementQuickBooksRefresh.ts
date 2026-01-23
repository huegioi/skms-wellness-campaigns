import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get admin user to update token data
    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const adminUser = adminUsers[0];
    
    const tokenData = adminUser.quickbooks_token_data || {
      refresh_count: 0,
      last_reset_date: new Date().toISOString(),
      last_notification_date: null
    };

    // Increment refresh count
    const newRefreshCount = (tokenData.refresh_count || 0) + 1;

    await base44.asServiceRole.entities.User.update(adminUser.id, {
      quickbooks_token_data: {
        ...tokenData,
        refresh_count: newRefreshCount
      }
    });

    return Response.json({
      success: true,
      refresh_count: newRefreshCount
    });

  } catch (error) {
    console.error('Token increment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});