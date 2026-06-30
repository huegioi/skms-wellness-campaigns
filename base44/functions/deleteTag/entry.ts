import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { name } = await req.json();
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    // 1. Delete the Tag record (case-insensitive match)
    const tags = await base44.asServiceRole.entities.Tag.list();
    const tag = tags.find(t => t.name?.toLowerCase() === name.toLowerCase());
    if (tag) {
      await base44.asServiceRole.entities.Tag.delete(tag.id);
    }

    // 2. Strip from all Leads
    let leadsUpdated = 0;
    let hasMore = true;
    let skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Lead.list('-created_date', 500, skip);
      const toUpdate = batch.filter(l => Array.isArray(l.tags) && l.tags.includes(name));
      if (toUpdate.length > 0) {
        await base44.asServiceRole.entities.Lead.bulkUpdate(
          toUpdate.map(l => ({
            id: l.id,
            tags: l.tags.filter(t => t !== name),
          }))
        );
        leadsUpdated += toUpdate.length;
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    // 3. Strip from all Clients
    let clientsUpdated = 0;
    hasMore = true;
    skip = 0;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Client.list('-created_date', 500, skip);
      const toUpdate = batch.filter(c => Array.isArray(c.tags) && c.tags.includes(name));
      if (toUpdate.length > 0) {
        await base44.asServiceRole.entities.Client.bulkUpdate(
          toUpdate.map(c => ({
            id: c.id,
            tags: c.tags.filter(t => t !== name),
          }))
        );
        clientsUpdated += toUpdate.length;
      }
      hasMore = batch.length === 500;
      skip += 500;
    }

    return Response.json({
      success: true,
      tagDeleted: !!tag,
      leadsUpdated,
      clientsUpdated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});