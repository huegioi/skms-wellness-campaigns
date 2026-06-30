import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

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

    // 2. Load all Leads whose tags contain oldName and replace
    let leadsUpdated = 0;
    let hasMore = true;
    let skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Lead.list('-created_date', 500, skip);
      const toUpdate = batch.filter(l => Array.isArray(l.tags) && l.tags.includes(oldName));
      if (toUpdate.length > 0) {
        await base44.asServiceRole.entities.Lead.bulkUpdate(
          toUpdate.map(l => ({
            id: l.id,
            tags: l.tags.map(t => t === oldName ? newName : t),
          }))
        );
        leadsUpdated += toUpdate.length;
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    // 3. Load all Clients whose tags contain oldName and replace
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

    return Response.json({
      success: true,
      tagUpdated: !!tag,
      leadsUpdated,
      clientsUpdated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});