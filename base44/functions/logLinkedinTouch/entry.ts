import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Logs a LinkedIn touch interaction and updates the entity's last-contact date.
 * Supports outbound (quick-log / with note) and inbound (reply received) directions.
 *
 * Payload: { entityType: 'lead'|'client'|'partner', entityId, note?, direction?, subject? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entityType, entityId, note, direction, subject } = await req.json();
    if (!entityType || !entityId) {
      return Response.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    const isOutbound = direction !== 'inbound';
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const defaultSubject = isOutbound ? 'LinkedIn message sent' : 'LinkedIn reply received';

    const interaction = {
      channel: 'linkedin',
      interaction_type: 'note',
      subject: subject || (note?.trim() ? `${defaultSubject}: ${note.trim()}` : defaultSubject),
      notes: note?.trim() || undefined,
      date: now,
    };

    if (entityType === 'lead') interaction.lead_id = entityId;
    else if (entityType === 'client') interaction.client_id = entityId;
    else if (entityType === 'partner') interaction.referral_partner_id = entityId;
    else return Response.json({ error: 'Invalid entityType' }, { status: 400 });

    await base44.entities.ClientInteraction.create(interaction);

    // Update last-touch on the entity (outbound only — inbound replies don't
    // reset our outreach cadence since we didn't initiate).
    if (isOutbound) {
      if (entityType === 'lead') {
        await base44.entities.Lead.update(entityId, {
          last_contacted_date: today,
          outreach_channel: 'linkedin',
        });
      } else if (entityType === 'client') {
        await base44.entities.Client.update(entityId, {
          last_contacted_date: today,
        });
      } else if (entityType === 'partner') {
        await base44.entities.ReferralPartner.update(entityId, {
          last_contacted_date: today,
          last_touchpoint_date: today,
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});