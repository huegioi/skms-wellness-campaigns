import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let totalDeleted = 0;
    const batchSize = 100;
    
    // Delete KajabiContacts in batches
    while (true) {
      const contacts = await base44.asServiceRole.entities.KajabiContact.list('', batchSize);
      
      if (contacts.length === 0) {
        break;
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

      console.log(`Deleted batch of ${contacts.length}, total: ${totalDeleted}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Delete all sync progress records
    const syncRecords = await base44.asServiceRole.entities.KajabiSyncProgress.list();
    for (const record of syncRecords) {
      try {
        await base44.asServiceRole.entities.KajabiSyncProgress.delete(record.id);
      } catch (err) {
        console.error(`Failed to delete sync record ${record.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      totalContactsDeleted: totalDeleted,
      syncRecordsDeleted: syncRecords.length,
      message: `Successfully purged ${totalDeleted} contacts and ${syncRecords.length} sync records`
    });

  } catch (error) {
    console.error('Purge error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});