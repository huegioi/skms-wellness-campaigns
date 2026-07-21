import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function normalizeInstrument(key, responses) {
  if (!responses) return null;
  switch (key) {
    case 'who5': {
      const raw = (responses.q1||0)+(responses.q2||0)+(responses.q3||0)+(responses.q4||0)+(responses.q5||0);
      return raw * 4;
    }
    case 'pss4': {
      const raw = (responses.q1||0)+(responses.q2||0)+(responses.q3||0)+(responses.q4||0);
      return ((16 - raw) / 16) * 100;
    }
    case 'uwes3': {
      const mean = ((responses.q1||0)+(responses.q2||0)+(responses.q3||0)) / 3;
      return (mean / 6) * 100;
    }
    case 'ucla3': {
      const raw = (responses.q1||0)+(responses.q2||0)+(responses.q3||0);
      return ((9 - raw) / 6) * 100;
    }
    default: return null;
  }
}

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
    const { token, who5, pss4, uwes3, ucla3 } = body;

    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

    const journeys = await base44.asServiceRole.entities.MfsJourney.filter({ survey_token: token }, undefined, 1);
    if (!journeys || journeys.length === 0) {
      return Response.json({ error: 'Invalid survey token' }, { status: 404 });
    }
    const journey = journeys[0];
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const submissionId = `mfj-${crypto.randomUUID()}`;

    const instruments = [
      { key: 'who5', responses: who5 },
      { key: 'pss4', responses: pss4 },
      { key: 'uwes3', responses: uwes3 },
      { key: 'ucla3', responses: ucla3 },
    ];

    for (const inst of instruments) {
      if (!inst.responses) continue;
      const raw = Object.values(inst.responses).reduce((s, v) => s + (v || 0), 0);
      const normalized = normalizeInstrument(inst.key, inst.responses);
      const record = {
        client_id: journey.client_id,
        survey_type: 'mfs',
        instrument: inst.key,
        participant_email: '',
        instrument_subscores: { _sid: submissionId, _normalized: normalized },
        instrument_total: raw,
        item_responses: inst.responses,
        cohort_year: year,
        submitted_at: now,
      };
      if (inst.key === 'who5') {
        record.who5_cheerful = inst.responses.q1;
        record.who5_calm = inst.responses.q2;
        record.who5_active = inst.responses.q3;
        record.who5_rested = inst.responses.q4;
        record.who5_interested = inst.responses.q5;
        record.who5_total = raw * 4;
      }
      await base44.asServiceRole.entities.CohortAssessment.create(record);
    }

    // Count distinct participants
    const allResponses = await base44.asServiceRole.entities.CohortAssessment.filter(
      { client_id: journey.client_id, survey_type: 'mfs' }, '-submitted_at', 500
    );
    const sids = new Set();
    for (const r of allResponses) {
      const sid = r.instrument_subscores?._sid;
      if (sid) sids.add(sid);
    }
    const participantCount = sids.size;

    // Status transitions (forward only)
    if (participantCount >= 5 && journey.status !== 'ready') {
      await base44.asServiceRole.entities.MfsJourney.update(journey.id, { status: 'ready' });

      // Send HR "dashboard ready" email
      const suppressed = await base44.asServiceRole.entities.EmailSuppression.filter({ email: journey.email });
      if (!suppressed || suppressed.length === 0) {
        const mailgunKey = Deno.env.get('MAILGUN_API_KEY');
        const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');
        if (mailgunKey && mailgunDomain) {
          const appUrl = new URL(req.url).origin;
          const dashboardUrl = `${appUrl}/FitnessRoi/dashboard?k=${journey.magic_key}`;
          const subject = 'Your team dashboard is ready';
          const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#0f766e;">Your team dashboard is ready</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">Great news — enough of your team has responded to unlock domain-level results. Your dashboard now shows team averages across wellbeing, stress, engagement, and connection.</p>
<a href="${dashboardUrl}" style="display:inline-block;background:#0f766e;color:white;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px;">View my dashboard</a>
<p style="color:#888;font-size:12px;margin-top:20px;">This link is private to you. Keep it safe to return any time.</p>
</body></html>`;
          try {
            await sendMailgun(mailgunKey, mailgunDomain, journey.email, subject, html);
            await base44.asServiceRole.entities.EmailLog.create({
              from_email: `mailgun@${mailgunDomain}`, to_email: journey.email,
              subject, body_preview: `Your team dashboard is ready. ${participantCount} responses received. Dashboard: ${dashboardUrl}`,
              date: now, direction: 'outbound',
              matched_client_id: journey.client_id, matched_lead_id: journey.lead_id,
            });
          } catch (e) { console.error('HR email failed:', e.message); }
        }
      }
    } else if (participantCount >= 1 && (journey.status === 'quick_done' || journey.status === 'team_launched')) {
      await base44.asServiceRole.entities.MfsJourney.update(journey.id, { status: 'collecting' });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});