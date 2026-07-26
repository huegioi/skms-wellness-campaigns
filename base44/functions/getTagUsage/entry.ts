import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const usage = {};

    // Count across Leads
    let hasMore = true;
    let skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Lead.list('-created_date', 500, skip);
      for (const lead of batch) {
        if (Array.isArray(lead.tags)) {
          for (const tag of lead.tags) {
            usage[tag] = (usage[tag] || 0) + 1;
          }
        }
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    // Count across Clients
    hasMore = true;
    skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Client.list('-created_date', 500, skip);
      for (const client of batch) {
        if (Array.isArray(client.tags)) {
          for (const tag of client.tags) {
            usage[tag] = (usage[tag] || 0) + 1;
          }
        }
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    // Count across ReferralPartners
    hasMore = true;
    skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 500, skip);
      for (const partner of batch) {
        if (Array.isArray(partner.tags)) {
          for (const tag of partner.tags) {
            usage[tag] = (usage[tag] || 0) + 1;
          }
        }
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    return Response.json({ usage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});