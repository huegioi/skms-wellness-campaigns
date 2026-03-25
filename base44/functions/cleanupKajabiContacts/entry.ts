import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { batchSize = 10 } = await req.json().catch(() => ({}));
    let totalDeleted = 0;

    // Delete just one small batch per call to avoid timeout
    const contacts = await base44.asServiceRole.entities.KajabiContact.list('', batchSize);
    
    if (contacts.length === 0) {
      return Response.json({
        success: true,
        completed: true,
        message: 'Cleanup complete! All contacts deleted.'
      });
    }

    // Delete this batch
    for (const contact of contacts) {
      try {
        await base44.asServiceRole.entities.KajabiContact.delete(contact.id);
        totalDeleted++;
      } catch (err) {
        console.error(`Failed to delete contact ${contact.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      completed: false,
      deletedThisBatch: totalDeleted,
      message: `Deleted ${totalDeleted} contacts. Call again to continue cleanup.`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});