import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { company_name, contact_name, email, team_size, goals, selected_service_ids, ref } = body;

    // ── Validate required fields ──
    if (!company_name || !contact_name || !email || !team_size) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // ── Rate limit: reject if same email submitted in the past hour ──
    const recentLeads = await base44.asServiceRole.entities.Lead.filter(
      { email: normalizedEmail },
      '-created_date',
      1
    );
    if (recentLeads.length > 0) {
      const lastSubmission = new Date(recentLeads[0].created_date);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastSubmission > oneHourAgo) {
        return Response.json(
          { error: 'rate_limited', message: 'You have already submitted recently. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // ── Look up service names for the notes ──
    const allServices = await base44.asServiceRole.entities.Service.list();
    const serviceMap = {};
    allServices.forEach(s => { serviceMap[s.id] = s.name; });
    const serviceIds = Array.isArray(selected_service_ids) ? selected_service_ids : [];
    const serviceNames = serviceIds.map(id => serviceMap[id] || id);

    // ── Build notes ──
    const notesLines = [];
    if (goals && goals.length > 0) {
      notesLines.push(`Goals: ${goals.join(', ')}`);
    }
    if (serviceNames.length > 0) {
      notesLines.push(`Selected services:\n${serviceNames.map(n => `- ${n}`).join('\n')}`);
    }
    const notes = notesLines.join('\n\n');

    // ── Build source ──
    const source = ref ? `Quick Builder (${ref})` : 'Quick Builder';

    // ── Create Lead ──
    await base44.asServiceRole.entities.Lead.create({
      name: contact_name,
      email: normalizedEmail,
      company: company_name,
      company_size: team_size,
      lead_type: 'company_inquiry',
      status: 'cold',
      source,
      notes,
      quickbuilder_selections: serviceIds,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});