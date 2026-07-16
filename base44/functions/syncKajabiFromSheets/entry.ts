import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1dHRcIu37VBo60y8r2huwWTZcPdaS9mmLBdtTYC-dGKo';
const SHEET_NAME = 'All contacts 02202026';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get Google Sheets access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Fetch all data from the sheet
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch sheet: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'No data found in spreadsheet' 
      });
    }

    // Parse header row
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const dataRows = rows.slice(1);

    console.log(`Found ${dataRows.length} contacts in sheet`);

    // Map sheet columns to contact data
    const getColumnIndex = (name) => headers.findIndex(h => h.includes(name));
    
    const emailIdx = getColumnIndex('email');
    const nameIdx = getColumnIndex('name');
    const subscribedIdx = getColumnIndex('subscribed') || getColumnIndex('subscription');
    const phoneIdx = getColumnIndex('phone');
    const tagsIdx = getColumnIndex('tag');
    const createdIdx = getColumnIndex('created');

    if (emailIdx === -1) {
      return Response.json({ 
        success: false, 
        error: 'Email column not found in sheet' 
      });
    }

    // Load existing contacts
    const existingContacts = await base44.asServiceRole.entities.KajabiContact.list('', 100000);
    const contactMap = new Map(existingContacts.map(c => [c.email?.toLowerCase(), c]));

    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const toCreate = [];
    const toUpdate = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const email = row[emailIdx]?.trim();

      if (!email || !email.includes('@')) {
        skippedCount++;
        continue;
      }

      const contactData = {
        kajabi_id: `sheet_${i}_${Date.now()}`,
        email: email,
        name: nameIdx !== -1 ? (row[nameIdx] || '') : '',
        subscribed: subscribedIdx !== -1 ? (row[subscribedIdx]?.toLowerCase() === 'true' || row[subscribedIdx]?.toLowerCase() === 'yes') : true,
        phone_number: phoneIdx !== -1 ? (row[phoneIdx] || '') : '',
        tags: tagsIdx !== -1 ? (row[tagsIdx] || '').split(',').map(t => t.trim()).filter(Boolean) : [],
        kajabi_created_at: createdIdx !== -1 ? (row[createdIdx] || new Date().toISOString()) : new Date().toISOString(),
        last_synced: new Date().toISOString()
      };

      const existing = contactMap.get(email.toLowerCase());

      if (existing) {
        const hasChanges = 
          existing.name !== contactData.name ||
          existing.subscribed !== contactData.subscribed ||
          existing.phone_number !== contactData.phone_number ||
          JSON.stringify(existing.tags || []) !== JSON.stringify(contactData.tags);

        if (hasChanges) {
          toUpdate.push({ id: existing.id, data: contactData });
          updatedCount++;
        }
      } else {
        toCreate.push(contactData);
        newCount++;
      }
    }

    // Batch create
    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.KajabiContact.bulkCreate(toCreate);
    }

    // Batch update
    if (toUpdate.length > 0) {
      for (let i = 0; i < toUpdate.length; i += 10) {
        const batch = toUpdate.slice(i, i + 10);
        await Promise.all(
          batch.map(({ id, data }) => 
            base44.asServiceRole.entities.KajabiContact.update(id, data)
          )
        );
      }
    }

    const finalContacts = await base44.asServiceRole.entities.KajabiContact.list('', 100000);

    // Update/create sync progress record
    const progressRecords = await base44.asServiceRole.entities.KajabiSyncProgress.filter({ 
      sync_type: 'contacts'
    });

    if (progressRecords.length > 0) {
      const latest = progressRecords[0];
      await base44.asServiceRole.entities.KajabiSyncProgress.update(latest.id, {
        status: 'completed',
        new_count: newCount,
        updated_count: updatedCount,
        total_processed: dataRows.length,
        completed_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.KajabiSyncProgress.create({
        sync_type: 'contacts',
        status: 'completed',
        new_count: newCount,
        updated_count: updatedCount,
        total_processed: dataRows.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
    }

    // Run analytics on the updated spreadsheet
    await base44.asServiceRole.functions.invoke('analyzeKajabiSheet');

    return Response.json({
      success: true,
      results: {
        totalInSheet: dataRows.length,
        new: newCount,
        updated: updatedCount,
        skipped: skippedCount,
        totalInDatabase: finalContacts.length,
        subscribedInDatabase: finalContacts.filter(c => c.subscribed).length,
        unsubscribedInDatabase: finalContacts.filter(c => !c.subscribed).length
      },
      message: `✅ Synced from Google Sheets! ${newCount} new, ${updatedCount} updated, ${skippedCount} skipped. Total: ${finalContacts.length} contacts.`
    });

  } catch (error) {
    console.error('Sheet sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});