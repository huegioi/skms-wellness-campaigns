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
    const maxBatches = 5; // Process 5 batches per call
    let batchesProcessed = 0;
    
    // Delete KajabiContacts in limited batches
    while (batchesProcessed < maxBatches) {
      const contacts = await base44.asServiceRole.entities.KajabiContact.list('', batchSize);
      
      if (contacts.length === 0) {
        // All done - also delete sync progress
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
          completed: true,
          totalContactsDeleted: totalDeleted,
          syncRecordsDeleted: syncRecords.length,
          message: `Purge complete! Deleted ${totalDeleted} contacts and ${syncRecords.length} sync records`
        });
      }

      // Delete this batch with parallel operations
      const deletePromises = contacts.map(contact => 
        base44.asServiceRole.entities.KajabiContact.delete(contact.id)
          .catch(err => console.error(`Failed to delete contact ${contact.id}:`, err.message))
      );
      
      await Promise.all(deletePromises);
      totalDeleted += contacts.length;
      
      console.log(`Deleted batch of ${contacts.length}, total: ${totalDeleted}`);
      batchesProcessed++;
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // More contacts remain
    return Response.json({
      success: true,
      completed: false,
      totalContactsDeleted: totalDeleted,
      message: `Deleted ${totalDeleted} contacts. More remain - call again to continue.`
    });

  } catch (error) {
    console.error('Purge error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});