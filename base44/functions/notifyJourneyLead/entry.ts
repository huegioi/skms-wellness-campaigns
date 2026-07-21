import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

async function sendMailgun(apiKey, domain, to, subject, html) {
  const formData = new FormData();
  formData.append('from', `SkillfulMeans Wellness <mailgun@${domain}>`);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);
  let response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST', headers: { 'Authorization': `Basic ${btoa(`api:${apiKey}`)}` }, body: formData
  });
  if (response.status === 401 || response.status === 404) {
    response = await fetch(`https://api.eu.mailgun.net/v3/${domain}/messages`, {
      method: 'POST', headers: { 'Authorization': `Basic ${btoa(`api:${apiKey}`)}` }, body: formData
    });
  }
  return response.ok;
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

    // Send internal alert email
    const teamEmails = (Deno.env.get('TEAM_EMAILS') || '').split(',').map(e => e.trim()).filter(Boolean);
    const mailgunKey = Deno.env.get('MAILGUN_API_KEY');
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');

    if (teamEmails.length > 0 && mailgunKey && mailgunDomain) {
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
      for (const email of teamEmails) {
        try {
          await sendMailgun(mailgunKey, mailgunDomain, email, subject, html);
        } catch (e) { console.error(`Alert failed for ${email}:`, e.message); }
      }
      await base44.asServiceRole.entities.EmailLog.create({
        from_email: `mailgun@${mailgunDomain}`, to_email: teamEmails.join(', '),
        subject, body_preview: `${companyName} clicked book-a-call. Composite ${compositeScore}, top domain ${topDomain}.`,
        date: now, direction: 'outbound', matched_client_id: j.client_id, matched_lead_id: j.lead_id,
      });
    }

    // Create ClientInteraction
    if (j.client_id) {
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