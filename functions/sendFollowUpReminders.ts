import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Get all pending/in_progress tasks with a reminder_date that has passed and not yet sent
    const tasks = await base44.asServiceRole.entities.FollowUpTask.filter({
      reminder_sent: false,
      status: { '$in': ['pending', 'in_progress', 'waiting_on_them'] }
    });

    const dueTasks = tasks.filter(task => {
      if (!task.reminder_date) return false;
      return new Date(task.reminder_date) <= now;
    });

    if (dueTasks.length === 0) {
      return Response.json({ message: 'No reminders to send', count: 0 });
    }

    // Get the app owner's email via connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = await profileRes.json();
    const ownerEmail = profile.email;

    let sentCount = 0;
    for (const task of dueTasks) {
      const priorityEmoji = { urgent: '🚨', high: '🔴', medium: '🟡', low: '🟢' }[task.priority] || '📌';
      const dueDateStr = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No due date';

      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #013f7c; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin:0;">⏰ Follow-Up Reminder</h2>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
            <h3 style="margin-top:0;">${priorityEmoji} ${task.title}</h3>
            ${task.contact_name ? `<p><strong>Contact:</strong> ${task.contact_name}${task.contact_email ? ` (${task.contact_email})` : ''}</p>` : ''}
            <p><strong>Due:</strong> ${dueDateStr}</p>
            ${task.description ? `<p><strong>Notes:</strong> ${task.description}</p>` : ''}
            ${task.source_snippet ? `<div style="background: white; border-left: 4px solid #264d44; padding: 12px; margin: 12px 0; border-radius: 4px;"><em style="color: #555;">"${task.source_snippet}"</em></div>` : ''}
            ${task.source_link ? `<p><a href="${task.source_link}" style="background: #264d44; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 8px;">Open Original Message →</a></p>` : ''}
          </div>
        </div>
      `;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: ownerEmail,
        subject: `[Follow-Up] ${priorityEmoji} ${task.title}`,
        body
      });

      await base44.asServiceRole.entities.FollowUpTask.update(task.id, { reminder_sent: true });
      sentCount++;
    }

    return Response.json({ message: `Sent ${sentCount} reminder(s)`, count: sentCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});