import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { record_type, record_id } = await req.json();

  let contextText = '';

  if (record_type === 'partner') {
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: record_id });
    const lead = leads[0];
    if (!lead) return Response.json({ error: 'Partner not found' }, { status: 404 });

    const partners = await base44.asServiceRole.entities.ReferralPartner.list();
    const matchedPartner = partners.find(p =>
      p.email?.toLowerCase() === lead.email?.toLowerCase() ||
      p.name?.toLowerCase() === lead.name?.toLowerCase()
    );

    const referrals = matchedPartner
      ? await base44.asServiceRole.entities.Referral.filter({ referral_partner_id: matchedPartner.id })
      : [];

    const daysSince = (d) => d ? Math.round((Date.now() - new Date(d)) / 86400000) : null;

    contextText = `PARTNER RECORD:
Name: ${lead.name}
Company: ${lead.company || 'Unknown'}
Tier: ${matchedPartner?.tier || lead.referral_potential || 'Unknown'}
Partner Status: ${lead.partner_status || 'Unknown'}
Pipeline Stage: ${lead.follow_up_stage || 'No stage set'}
Last Contacted: ${lead.last_contacted_date ? `${new Date(lead.last_contacted_date).toLocaleDateString()} (${daysSince(lead.last_contacted_date)} days ago)` : 'Never'}
Last Touchpoint: ${matchedPartner?.last_touchpoint_date ? `${new Date(matchedPartner.last_touchpoint_date).toLocaleDateString()} (${daysSince(matchedPartner.last_touchpoint_date)} days ago)` : 'Unknown'}
Last Referral: ${lead.last_referral_date ? `${new Date(lead.last_referral_date).toLocaleDateString()} (${daysSince(lead.last_referral_date)} days ago)` : 'None'}
Total Referrals: ${lead.referral_count || 0}
Referral Potential: ${lead.referral_potential || 'Unknown'}
Outreach Channel: ${lead.outreach_channel || 'Unknown'}
YTD Revenue from Partner: $${(matchedPartner?.ytd_revenue || 0).toLocaleString()}
Total Commissions Paid: $${(matchedPartner?.total_commissions_paid || 0).toLocaleString()}
Renewal Cohort: ${matchedPartner?.renewal_cohort || 'Unknown'}

RECENT REFERRALS (${referrals.length} total):
${referrals.slice(0, 5).map(r => `- ${r.company_name || r.contact_name} | Status: ${r.status} | Revenue: $${(r.first_year_revenue || 0).toLocaleString()} | Date: ${r.referral_date ? new Date(r.referral_date).toLocaleDateString() : 'Unknown'}`).join('\n') || 'No referrals yet'}

NOTES: ${lead.notes || 'None'}`;

  } else if (record_type === 'client') {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: record_id });
    const client = clients[0];
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const [proposals, interactions] = await Promise.all([
      base44.asServiceRole.entities.Proposal.list('-created_date'),
      base44.asServiceRole.entities.ClientInteraction.filter({ client_id: client.id }, '-date'),
    ]);

    const clientProposals = proposals.filter(p => p.client_id === client.id);
    const acceptedValue = clientProposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.total_amount || 0), 0);
    const daysSince = (d) => d ? Math.round((Date.now() - new Date(d)) / 86400000) : null;

    contextText = `CLIENT RECORD:
Name: ${client.company || client.name}
Primary Contact: ${client.name}${client.title ? ` (${client.title})` : ''}
Industry: ${client.industry || 'Unknown'}
Company Size: ${client.company_size || 'Unknown'}
Client Stage: ${client.client_stage || 'Unknown'}
Tier: ${client.tier || 'Not set'}
Renewal Cohort: ${client.renewal_cohort || 'Not set'}
Plan Year Start: ${client.plan_year_start || 'Not set'}
Last Contacted: ${client.last_contacted_date ? `${new Date(client.last_contacted_date).toLocaleDateString()} (${daysSince(client.last_contacted_date)} days ago)` : 'Unknown'}
Last Touchpoint: ${client.last_touchpoint_date ? `${new Date(client.last_touchpoint_date).toLocaleDateString()} (${daysSince(client.last_touchpoint_date)} days ago)` : 'Unknown'}
Last Service Date: ${client.last_service_date || 'Not set'}
Wellness Budget: ${client.wellness_budget ? `$${client.wellness_budget.toLocaleString()}` : 'Unknown'}
Wellness Fund/Employee: ${client.wellness_fund_size ? `$${client.wellness_fund_size.toLocaleString()}` : 'Unknown'}
Referral Partner: ${client.referral_partner_name || 'None'}
Owner: ${client.owner || 'Unassigned'}

PROPOSAL SUMMARY:
Total Proposals: ${clientProposals.length}
Accepted Value: $${acceptedValue.toLocaleString()}
Total QB Invoice Value: $${(client.total_invoice_value || 0).toLocaleString()}
Latest Proposal Status: ${clientProposals[0]?.status || 'None'}

RECENT ACTIVITY (last 5 interactions):
${interactions.slice(0, 5).map(i => `- ${i.interaction_type} on ${new Date(i.date).toLocaleDateString()}: ${i.subject || ''} ${i.notes ? `| ${i.notes.slice(0, 80)}` : ''}`).join('\n') || 'No logged interactions'}

NOTES: ${client.notes || 'None'}`;
  } else {
    return Response.json({ error: 'Invalid record_type' }, { status: 400 });
  }

  const systemPrompt = `You are Maya, the expert Sales Director for SKMS Wellness. Analyze the provided company data. In 3-4 bullet points, deliver immediate, highly actionable sales or relationship management advice for the founder. Tell them exactly what to focus on next, what risks to watch out for, or what specific value-add to bring up in their next conversation. Keep it concise, strategic, and direct.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        { role: 'user', content: contextText }
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return Response.json({ error: `Anthropic API error: ${err}` }, { status: 500 });
  }

  const data = await response.json();
  const insights = data.content?.[0]?.text || 'No insights generated.';

  return Response.json({ insights });
});