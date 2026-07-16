import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';
const TAB_NAME = 'Partner Leads';

const REQUIRED_COLUMNS = ['Name', 'Email', 'Company', 'Phone', 'Source', 'Kajabi Contact ID', 'Follow up Stage'];


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // 1. Verify the tab exists — never create/rename/delete it
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
      { headers: authHeaders }
    );
    const meta = await metaRes.json();
    const tabTitles = meta.sheets?.map(s => s.properties?.title) || [];
    if (!tabTitles.includes(TAB_NAME)) {
      return Response.json({
        error: `Tab "${TAB_NAME}" not found in spreadsheet. Available tabs: ${tabTitles.join(', ')}`,
      }, { status: 400 });
    }
    const encodedTab = encodeURIComponent(TAB_NAME);

    // 2. Read existing header row
    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!1:1`,
      { headers: authHeaders }
    );
    const headerData = await headerRes.json();
    let headerRow = headerData.values?.[0] || [];

    // 3. Add any missing required columns to the right of existing ones
    const lowerHeaders = headerRow.map(h => (h || '').trim().toLowerCase());
    const missingColumns = REQUIRED_COLUMNS.filter(
      col => !lowerHeaders.includes(col.toLowerCase())
    );
    if (missingColumns.length > 0) {
      headerRow = [...headerRow, ...missingColumns];
      const lastCol = String.fromCharCode(65 + headerRow.length - 1);
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!A1:${lastCol}1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: `${TAB_NAME}!A1:${lastCol}1`, values: [headerRow] }),
        }
      );
      if (!updateRes.ok) {
        return Response.json({ error: 'Failed to update header row', details: await updateRes.text() }, { status: 500 });
      }
      console.log(`Added missing columns: ${missingColumns.join(', ')}`);
    }

    // Build column index map
    const colMap = {};
    headerRow.forEach((h, i) => {
      const lower = (h || '').trim().toLowerCase();
      if (!colMap[lower]) colMap[lower] = i;
    });
    const numCols = headerRow.length;
    const lastCol = String.fromCharCode(65 + numCols - 1);

    // 4. Gather all records — broker leads + referral partners, deduped by email
    const brokerLeads = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker' }, '-created_date', 1000);
    const brokerLeadLeads = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }, '-created_date', 1000);
    const partners = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 1000);

    const deduped = new Map(); // lowercase email -> row data

    for (const lead of [...brokerLeads, ...brokerLeadLeads]) {
      if (!lead.email) continue;
      const normEmail = lead.email.trim().toLowerCase();
      if (deduped.has(normEmail)) continue;
      deduped.set(normEmail, {
        name: lead.name || '',
        email: lead.email,
        company: lead.company || '',
        phone: lead.phone || '',
        source: lead.lead_type === 'broker_lead' ? 'broker_lead' : 'broker',
        kajabi_contact_id: lead.kajabi_contact_id || '',
        follow_up_stage: lead.follow_up_stage || '',
      });
    }

    for (const partner of partners) {
      if (!partner.email) continue;
      const normEmail = partner.email.trim().toLowerCase();
      if (deduped.has(normEmail)) continue;
      deduped.set(normEmail, {
        name: partner.name || '',
        email: partner.email,
        company: partner.company || '',
        phone: partner.phone || '',
        source: 'Referral Partner',
        kajabi_contact_id: partner.kajabi_contact_id || '',
        follow_up_stage: partner.follow_up_stage || '',
      });
    }

    const records = Array.from(deduped.values());
    console.log(`Consolidated ${records.length} records (${brokerLeads.length} broker + ${brokerLeadLeads.length} broker_lead + ${partners.length} partners, deduped by email)`);

    // 5. Build row arrays aligned to header columns
    const dataRows = records.map(rec => {
      const row = new Array(numCols).fill('');
      if (colMap['name'] !== undefined) row[colMap['name']] = rec.name;
      if (colMap['email'] !== undefined) row[colMap['email']] = rec.email;
      if (colMap['company'] !== undefined) row[colMap['company']] = rec.company;
      if (colMap['phone'] !== undefined) row[colMap['phone']] = rec.phone;
      if (colMap['source'] !== undefined) row[colMap['source']] = rec.source;
      if (colMap['kajabi contact id'] !== undefined) row[colMap['kajabi contact id']] = rec.kajabi_contact_id;
      if (colMap['follow up stage'] !== undefined) row[colMap['follow up stage']] = rec.follow_up_stage;
      return row;
    });

    // 6. Clear all existing data rows (row 2 onwards), then write fresh
    // Clear a generous range to remove stale rows
    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!A2:Z10000`,
      {
        method: 'DELETE',
        headers: authHeaders,
      }
    );
    if (!clearRes.ok && clearRes.status !== 400) {
      // 400 means range had no data — acceptable
      console.warn(`Clear returned ${clearRes.status}: ${await clearRes.text()}`);
    }

    // Write all rows in a single batch update (or append if no data)
    let writtenCount = 0;
    if (dataRows.length > 0) {
      const range = `${TAB_NAME}!A2:${lastCol}${dataRows.length + 1}`;
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range, values: dataRows }),
        }
      );
      if (!writeRes.ok) {
        return Response.json({ error: 'Failed to write data rows', details: await writeRes.text() }, { status: 500 });
      }
      writtenCount = dataRows.length;
    }

    console.log(`Sync complete: ${writtenCount} rows written to "${TAB_NAME}"`);

    return Response.json({
      success: true,
      tab: TAB_NAME,
      columns_added: missingColumns.length > 0 ? missingColumns : [],
      total_columns: numCols,
      broker_leads: brokerLeads.length + brokerLeadLeads.length,
      referral_partners: partners.length,
      deduped_total: records.length,
      rows_written: writtenCount,
    });

  } catch (error) {
    console.error('syncPartnerLeadsToSheet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});