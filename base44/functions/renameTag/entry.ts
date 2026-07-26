import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Team only' }, { status: 403 });

    const { oldName, newName, color, description } = await req.json();
    if (!oldName || !newName) {
      return Response.json({ error: 'oldName and newName are required' }, { status: 400 });
    }

    // 1. Update the Tag record (case-insensitive match by name)
    const tags = await base44.asServiceRole.entities.Tag.list();
    const tag = tags.find(t => t.name?.toLowerCase() === oldName.toLowerCase());
    if (tag) {
      const updateData = { name: newName };
      if (color) updateData.color = color;
      if (description !== undefined) updateData.description = description;
      await base44.asServiceRole.entities.Tag.update(tag.id, updateData);
    }

    // 2. Replace oldName→newName in all Lead tags arrays; collect affected leads for sheet sync
    const affectedLeads = [];
    let leadsUpdated = 0;
    let hasMore = true;
    let skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Lead.list('-created_date', 500, skip);
      const toUpdate = batch.filter(l => Array.isArray(l.tags) && l.tags.includes(oldName));
      if (toUpdate.length > 0) {
        const updatedLeads = toUpdate.map(l => ({
          ...l,
          tags: l.tags.map(t => t === oldName ? newName : t),
        }));
        await base44.asServiceRole.entities.Lead.bulkUpdate(
          updatedLeads.map(l => ({ id: l.id, tags: l.tags }))
        );
        leadsUpdated += toUpdate.length;
        affectedLeads.push(...updatedLeads);
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    // 3. Replace in all Client tags arrays
    let clientsUpdated = 0;
    hasMore = true;
    skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Client.list('-created_date', 500, skip);
      const toUpdate = batch.filter(c => Array.isArray(c.tags) && c.tags.includes(oldName));
      if (toUpdate.length > 0) {
        await base44.asServiceRole.entities.Client.bulkUpdate(
          toUpdate.map(c => ({
            id: c.id,
            tags: c.tags.map(t => t === oldName ? newName : t),
          }))
        );
        clientsUpdated += toUpdate.length;
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    // 4. Replace in all ReferralPartner tags arrays
    let partnersUpdated = 0;
    hasMore = true;
    skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 500, skip);
      const toUpdate = batch.filter(p => Array.isArray(p.tags) && p.tags.includes(oldName));
      if (toUpdate.length > 0) {
        await base44.asServiceRole.entities.ReferralPartner.bulkUpdate(
          toUpdate.map(p => ({
            id: p.id,
            tags: p.tags.map(t => t === oldName ? newName : t),
          }))
        );
        partnersUpdated += toUpdate.length;
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    // 5. Rewrite Tags cell of affected Lead rows in the Google Sheet (best-effort)
    let sheetSynced = 0;
    for (const lead of affectedLeads) {
      try {
        const sheetName = lead.sheet_origin?.replace('BrokerLeads:', '') || 'Referral Partners';
        await base44.functions.invoke('syncBrokerLeadsSheet', {
          action: 'updateTags',
          leadId: lead.id,
          email: lead.email,
          sheetRowId: lead.sheet_row_id,
          sheetName,
          tags: lead.tags,
        });
        sheetSynced++;
      } catch (e) {
        console.warn(`Failed to sync tags to sheet for lead ${lead.id}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      tagUpdated: !!tag,
      leadsUpdated,
      clientsUpdated,
      partnersUpdated,
      sheetSynced,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});