import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called by entity automations when a Client or Lead is deleted.
// Records the email in DeletedContact so syncs skip re-importing them.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data, old_data } = body;
    const record = data || old_data;

    if (!record?.email) {
      return Response.json({ skipped: true, reason: 'No email on deleted record' });
    }

    const email = record.email.toLowerCase().trim();
    const entityName = event?.entity_name || '';
    const contact_type = entityName === 'Client' ? 'client' : 'lead';

    // Check if already tombstoned
    const existing = await base44.asServiceRole.entities.DeletedContact.filter({ email });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'Already tombstoned', email });
    }

    await base44.asServiceRole.entities.DeletedContact.create({
      email,
      name: record.name || '',
      contact_type,
      original_id: event?.entity_id || '',
    });

    console.log(`Tombstoned ${contact_type}: ${email} (${record.name || 'unnamed'})`);
    return Response.json({ success: true, email, contact_type });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});