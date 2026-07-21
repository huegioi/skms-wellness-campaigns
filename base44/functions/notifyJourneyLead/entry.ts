import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

async function sendSendGrid(to, subject, html) {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!apiKey) { console.error('SENDGRID_API_KEY not set'); return false; }
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'admin@skillfulmeans.life', name: 'SkillfulMeans' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`SendGrid error (${response.status}): ${errorText}`);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { magic_key } = body;

    if (!magic_key) return Response.json({ error: 'missing_key' }, { status: 400 });

    const journeys = await base44.asServiceRole.entities.MfsJourney.filter({ magic_key }, undefined, 1);
    if (!journeys || journeys.length === 0) {
      return Response.json({ error: 'invalid_key' }, { status: 404 });
    }
    const j = journeys[0];

    // Guard: fire once
    if (j.booked_call_at) {
      return Response.json({ success: true, already_notified: true });
    }

    const now = new Date().toISOString();
    const isDemo = j.is_demo === true;
    const companyName = j.company_name || 'Unknown';
    const compositeScore = j.quick_scores?.composite != null ? Math.round(j.quick_scores.composite) : '—';

    // Compute top domain from team scores if available
    let topDomain = '—';
    if (j.quick_scores) {
      const domains = [
        { key: 'pss4', label: 'Stress', score: j.quick_scores.pss4 },
        { key: 'who5', label: 'Wellbeing', score: j.quick_scores.who5 },
        { key: 'uwes3', label: 'Engagement', score: j.quick_scores.uwes3 },
        { key: 'ucla3', label: 'Connection', score: j.quick_scores.ucla3 },
      ].filter(d => d.score != null).sort((a, b) => a.score - b.score);
      if (domains.length > 0) topDomain = domains[0].label;
    }

    // Send internal alert email (skip for demos — no team pings during demo click-throughs)
    const teamEmails = (Deno.env.get('TEAM_EMAILS') || '').split(',').map(e => e.trim()).filter(Boolean);

    if (!isDemo && teamEmails.length > 0) {
      const subject = `${companyName} clicked book-a-call from their team dashboard — composite ${compositeScore}, top domain ${topDomain}`;
      const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#0f766e;">${companyName} clicked book-a-call</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">The HR leader at ${companyName} clicked "Book a call" from their team dashboard.</p>
<ul style="color:#444;font-size:14px;line-height:1.8;">
<li>Composite score: <strong>${compositeScore}/100</strong></li>
<li>Top opportunity domain: <strong>${topDomain}</strong></li>
</ul>
<p style="color:#888;font-size:12px;margin-top:16px;">Contact: ${j.email || 'N/A'}</p>
</body></html>`;
      let alertSent = false;
      for (const email of teamEmails) {
        try {
          const sent = await sendSendGrid(email, subject, html);
          if (sent) alertSent = true;
        } catch (e) { console.error(`Alert failed for ${email}:`, e.message); }
      }
      if (alertSent) {
        await base44.asServiceRole.entities.EmailLog.create({
          from_email: 'admin@skillfulmeans.life', to_email: teamEmails.join(', '),
          subject, body_preview: `${companyName} clicked book-a-call. Composite ${compositeScore}, top domain ${topDomain}.`,
          date: now, direction: 'outbound', matched_client_id: j.client_id, matched_lead_id: j.lead_id,
        });
      }
    }

    // Create ClientInteraction (skip for demos)
    if (!isDemo && j.client_id) {
      await base44.asServiceRole.entities.ClientInteraction.create({
        client_id: j.client_id,
        interaction_type: 'call',
        channel: 'other',
        date: now,
        subject: 'Strategy call booked from ROI dashboard',
        notes: `${companyName} clicked "Book a call" from their team dashboard. Composite: ${compositeScore}, top domain: ${topDomain}.`,
      });
    }

    // Set booked_call_at
    await base44.asServiceRole.entities.MfsJourney.update(j.id, { booked_call_at: now });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});