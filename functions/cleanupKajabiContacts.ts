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

    // Delete in batches to avoid timeout
    while (true) {
      const contacts = await base44.asServiceRole.entities.KajabiContact.list('', 100);
      
      if (contacts.length === 0) {
        break;
      }

      // Delete batch
      await Promise.all(
        contacts.map(contact => 
          base44.asServiceRole.entities.KajabiContact.delete(contact.id)
        )
      );

      totalDeleted += contacts.length;
      batchCount++;
      
      console.log(`Deleted batch ${batchCount}: ${contacts.length} contacts (total: ${totalDeleted})`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
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