import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Convert simple markdown-ish text to HTML paragraphs/bullets
function briefingToHtml(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      if (!inList) { html += '<ul style="margin:8px 0 8px 20px;padding:0;">'; inList = true; }
      html += `<li style="margin-bottom:6px;color:#374151;">${line.slice(2)}</li>`;
    } else if (/^\*\*(.+)\*\*$/.test(line) || /^###/.test(line) || /^##/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      const heading = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      html += `<h3 style="margin:20px 0 6px;font-size:15px;font-weight:700;color:#013f7c;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">${heading}</h3>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      // inline bold + list items (1. 2. 3.)
      let formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<p style="margin:8px 0;color:#374151;line-height:1.6;">${formatted}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function buildEmail(briefingText, stats, dateStr) {
  const briefingHtml = briefingToHtml(briefingText);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Maya's Daily Briefing</title></head>
<body style="margin:0;padding:0;background:#f4f0e9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e9;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#013f7c;padding:28px 36px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#93c5fd;text-transform:uppercase;">SKMS Wellness</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Maya's Daily Briefing</h1>
            <p style="margin:6px 0 0;font-size:14px;color:#bfdbfe;">${dateStr}</p>
          </td>
        </tr>

        <!-- Briefing body -->
        <tr>
          <td style="padding:32px 36px 24px;">
            ${briefingHtml}
          </td>
        </tr>

        <!-- Stats bar -->
        <tr>
          <td style="padding:0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-radius:8px;overflow:hidden;">
              <tr>
                <td align="center" style="padding:14px 8px;border-right:1px solid #d1d5db;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#013f7c;">${stats.overdue_partners ?? 0}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Overdue Partners</p>
                </td>
                <td align="center" style="padding:14px 8px;border-right:1px solid #d1d5db;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#013f7c;">${stats.silent_clients ?? 0}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Silent Clients</p>
                </td>
                <td align="center" style="padding:14px 8px;border-right:1px solid #d1d5db;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#013f7c;">${stats.renewal_clients ?? 0}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">In Renewal Window</p>
                </td>
                <td align="center" style="padding:14px 8px;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#264d44;">${stats.active_partners ?? 0}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Active Partners</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:0 36px 36px;">
            <a href="https://curriculum-designer-05b51a3b.base44.app/" style="display:inline-block;background:#013f7c;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.3px;">Open Dashboard →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Generated by Maya · SKMS Wellness · Sent daily at 7:00 AM ET</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const now = new Date();
    const dateStr = formatDate(now);

    // Delegate to the shared briefing function — keeps dashboard + email in sync.
    // Use user-context invoke (not asServiceRole) so the caller's session forwards
    // through mayaDailyBriefing's auth guard.
    const briefingResponse = await base44.functions.invoke('mayaDailyBriefing', {});
    const briefingData = briefingResponse.data || briefingResponse;
    const briefing = briefingData?.briefing || 'Briefing unavailable this morning.';
    const stats = briefingData?.stats || {};

    const subject = `Maya's Daily Briefing — ${dateStr}`;
    const htmlBody = buildEmail(briefing, stats, dateStr);

    const recipients = ['william@skillfulmeans.life', 'heather@skillfulmeans.life'];

    await Promise.all(recipients.map(to =>
      base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: htmlBody,
        from_name: 'Maya · SKMS Wellness',
      })
    ));

    console.log(`Maya briefing email sent to ${recipients.join(', ')} on ${dateStr}`);
    return Response.json({ success: true, sent_to: recipients, date: dateStr, stats });
  } catch (error) {
    console.error('Maya briefing email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});