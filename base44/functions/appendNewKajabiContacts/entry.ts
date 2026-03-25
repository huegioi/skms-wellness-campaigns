import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1dHRcIu37VBo60y8r2huwWTZcPdaS9mmLBdtTYC-dGKo';
const SHEET_NAME = 'All contacts 02202026';
const KAJABI_API_URL = 'https://api.kajabi.com/v1';

async function getKajabiAccessToken() {
  const clientId = Deno.env.get('KAJABI_CLIENT_ID');
  const clientSecret = Deno.env.get('KAJABI_CLIENT_SECRET');

  const response = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to get Kajabi token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get tokens
    const kajabiToken = await getKajabiAccessToken();
    const sheetsToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    const siteId = Deno.env.get('KAJABI_SITE_ID');

    // Fetch contacts created in last 24 hours from Kajabi
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    console.log(`Fetching Kajabi contacts created after: ${yesterdayISO}`);

    const kajabiResponse = await fetch(
      `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&filter[created_at_from]=${yesterdayISO}&page[size]=100`,
      {
        headers: {
          'Authorization': `Bearer ${kajabiToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!kajabiResponse.ok) {
      throw new Error(`Kajabi API error: ${await kajabiResponse.text()}`);
    }

    const kajabiData = await kajabiResponse.json();
    const newContacts = kajabiData.data || [];

    console.log(`Found ${newContacts.length} new Kajabi contacts in last 24 hours`);

    if (newContacts.length === 0) {
      return Response.json({
        success: true,
        results: { newContactsFound: 0, appended: 0 },
        message: 'No new contacts to append'
      });
    }

    // Fetch existing sheet to check for duplicates
    const sheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      {
        headers: {
          'Authorization': `Bearer ${sheetsToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!sheetResponse.ok) {
      throw new Error(`Sheets API error: ${await sheetResponse.text()}`);
    }

    const sheetData = await sheetResponse.json();
    const existingRows = sheetData.values || [];
    const headers = existingRows[0] || ['Email', 'Name', 'Subscribed', 'Phone', 'Tags', 'Created At'];
    const existingEmails = new Set(existingRows.slice(1).map(row => row[0]?.toLowerCase()));

    // Prepare new rows
    const newRows = [];
    for (const contact of newContacts) {
      const attrs = contact.attributes;
      const email = attrs.email?.toLowerCase();

      if (!email || existingEmails.has(email)) {
        continue; // Skip duplicates
      }

      // Fetch tags for this contact
      const tagsResponse = await fetch(
        `${KAJABI_API_URL}/contacts/${contact.id}/tags`,
        {
          headers: {
            'Authorization': `Bearer ${kajabiToken}`,
            'Accept': 'application/json'
          }
        }
      );

      let tags = [];
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        tags = (tagsData.data || []).map(t => t.attributes?.name).filter(Boolean);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

      newRows.push([
        attrs.email || '',
        attrs.name || '',
        attrs.subscribed ? 'Yes' : 'No',
        attrs.phone_number || '',
        tags.join(', '),
        attrs.created_at || new Date().toISOString()
      ]);
    }

    if (newRows.length === 0) {
      return Response.json({
        success: true,
        results: { newContactsFound: newContacts.length, appended: 0 },
        message: 'All new contacts already exist in sheet'
      });
    }

    // Append to sheet
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sheetsToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: newRows })
      }
    );

    if (!appendResponse.ok) {
      throw new Error(`Failed to append to sheet: ${await appendResponse.text()}`);
    }

    // Also sync to KajabiContact entity
    const toCreate = newRows.map((row, idx) => ({
      kajabi_id: newContacts[idx]?.id || `new_${Date.now()}_${idx}`,
      email: row[0],
      name: row[1],
      subscribed: row[2] === 'Yes',
      phone_number: row[3],
      tags: row[4].split(',').map(t => t.trim()).filter(Boolean),
      kajabi_created_at: row[5],
      last_synced: new Date().toISOString()
    }));

    await base44.asServiceRole.entities.KajabiContact.bulkCreate(toCreate);

    // Update/create sync progress record
    const progressRecords = await base44.asServiceRole.entities.KajabiSyncProgress.filter({ 
      sync_type: 'contacts'
    });

    if (progressRecords.length > 0) {
      const latest = progressRecords[0];
      await base44.asServiceRole.entities.KajabiSyncProgress.update(latest.id, {
        status: 'completed',
        new_count: (latest.new_count || 0) + newRows.length,
        total_processed: (latest.total_processed || 0) + newRows.length,
        completed_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.KajabiSyncProgress.create({
        sync_type: 'contacts',
        status: 'completed',
        new_count: newRows.length,
        total_processed: newRows.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
    }

    // Run analytics on the updated spreadsheet
    await base44.asServiceRole.functions.invoke('analyzeKajabiSheet');

    return Response.json({
      success: true,
      results: {
        newContactsFound: newContacts.length,
        appended: newRows.length
      },
      message: `✅ Appended ${newRows.length} new contacts to Google Sheets`
    });

  } catch (error) {
    console.error('Append contacts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});