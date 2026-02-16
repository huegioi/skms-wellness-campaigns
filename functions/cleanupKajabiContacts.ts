import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let totalDeleted = 0;
    let batchCount = 0;

    // Delete in smaller batches to avoid rate limits
    while (true) {
      const contacts = await base44.asServiceRole.entities.KajabiContact.list('', 50);
      
      if (contacts.length === 0) {
        break;
      }

      // Delete one at a time with delay to avoid rate limits
      for (const contact of contacts) {
        await base44.asServiceRole.entities.KajabiContact.delete(contact.id);
        totalDeleted++;
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      batchCount++;
      console.log(`Completed batch ${batchCount}: ${contacts.length} contacts (total: ${totalDeleted})`);
    }

    return Response.json({
      success: true,
      message: `Successfully deleted ${totalDeleted} contacts in ${batchCount} batches`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});