import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get or initialize token tracking data from user entity
    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const adminUser = adminUsers[0];
    
    const tokenData = adminUser.quickbooks_token_data || {
      refresh_count: 0,
      last_reset_date: new Date().toISOString(),
      last_notification_date: null
    };

    const refreshCount = tokenData.refresh_count || 0;
    const lastResetDate = new Date(tokenData.last_reset_date || new Date());
    const daysSinceReset = Math.floor((Date.now() - lastResetDate.getTime()) / (1000 * 60 * 60 * 24));

    // Thresholds for notifications
    const REFRESH_WARNING_THRESHOLD = 80; // Warn at 80 refreshes
    const DAYS_WARNING_THRESHOLD = 85; // Warn at 85 days

    let shouldNotify = false;
    let notificationMessage = '';

    // Check refresh count
    if (refreshCount >= REFRESH_WARNING_THRESHOLD && refreshCount < 100) {
      shouldNotify = true;
      notificationMessage = `⚠️ QuickBooks Token Alert\n\n` +
        `Your QuickBooks refresh token has been used ${refreshCount} times out of 100.\n\n` +
        `You have approximately ${100 - refreshCount} refreshes remaining before you need to manually re-authorize.\n\n` +
        `Please plan to re-authorize your QuickBooks connection soon.`;
    }

    // Check days since last reset
    if (daysSinceReset >= DAYS_WARNING_THRESHOLD && daysSinceReset < 100) {
      shouldNotify = true;
      notificationMessage = `⚠️ QuickBooks Token Alert\n\n` +
        `Your QuickBooks refresh token is ${daysSinceReset} days old.\n\n` +
        `Refresh tokens typically expire after 100 days of inactivity.\n\n` +
        `Please plan to re-authorize your QuickBooks connection soon.`;
    }

    // If both conditions are met, combine the message
    if (refreshCount >= REFRESH_WARNING_THRESHOLD && daysSinceReset >= DAYS_WARNING_THRESHOLD) {
      notificationMessage = `⚠️ QuickBooks Token Alert\n\n` +
        `Your QuickBooks refresh token needs attention:\n` +
        `- Used ${refreshCount} times out of 100\n` +
        `- ${daysSinceReset} days old (expires around 100 days)\n\n` +
        `Please re-authorize your QuickBooks connection as soon as possible.`;
    }

    // Send notification if needed and hasn't been sent in the last 7 days
    if (shouldNotify) {
      const lastNotificationDate = tokenData.last_notification_date ? 
        new Date(tokenData.last_notification_date) : null;
      
      const daysSinceLastNotification = lastNotificationDate ? 
        Math.floor((Date.now() - lastNotificationDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;

      if (daysSinceLastNotification >= 7) {
        // Send email notification
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: '⚠️ QuickBooks Token Expiration Warning',
          body: notificationMessage
        });

        // Update last notification date
        await base44.asServiceRole.entities.User.update(adminUser.id, {
          quickbooks_token_data: {
            ...tokenData,
            last_notification_date: new Date().toISOString()
          }
        });

        return Response.json({
          success: true,
          notification_sent: true,
          message: notificationMessage,
          refresh_count: refreshCount,
          days_since_reset: daysSinceReset
        });
      }
    }

    return Response.json({
      success: true,
      notification_sent: false,
      refresh_count: refreshCount,
      days_since_reset: daysSinceReset,
      status: 'Token is healthy'
    });

  } catch (error) {
    console.error('Token monitoring error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});