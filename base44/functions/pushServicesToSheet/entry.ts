import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SERVICES_SHEET_ID = '1qYMjE_ZWwUVl3nFC4k4RGHLpmDCG8lg1hEY9cGZZ-P8';

const CATEGORY_DISPLAY = {
  workshop: 'Workshop',
  challenge: 'Challenge',
  leadership: 'Leadership',
  class: 'Class',
  wellness_box: 'Wellness Box',
};


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // 1. Get actual tab name
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SERVICES_SHEET_ID}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const tabName = meta.sheets?.[0]?.properties?.title || 'Sheet1';
    const encodedTab = encodeURIComponent(tabName);

    // 2. Read sheet to get headers and existing rows
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SERVICES_SHEET_ID}/values/${encodedTab}!A1:Z1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const sheetData = await readRes.json();
    const rows = sheetData.values || [];

    if (rows.length === 0) {
      return Response.json({ error: 'Sheet is empty — no headers found' }, { status: 400 });
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idx = {
      category: headers.findIndex(h => h.includes('category')),
      name: headers.findIndex(h => h.includes('title') || h.includes('name')),
      description: headers.findIndex(h => h.includes('description')),
      price: headers.findIndex(h => h.includes('price')),
      duration: headers.findIndex(h => h.includes('length') || h.includes('duration')),
      active: headers.findIndex(h => h.includes('active')),
      audience: headers.findIndex(h => h.includes('audience')),
    };

    // Map existing rows by name for dedup
    const existingRowsByName = {};
    rows.slice(1).forEach((row, i) => {
      const name = idx.name >= 0 ? (row[idx.name] || '').trim().toLowerCase() : '';
      if (name) existingRowsByName[name] = i + 2; // 1-based, skip header row
    });

    // 3. Load all services from DB
    const services = await base44.asServiceRole.entities.Service.list('sort_order');
    const numCols = headers.length;

    const makeRow = (svc) => {
      const row = new Array(numCols).fill('');
      if (idx.category >= 0) row[idx.category] = CATEGORY_DISPLAY[svc.category] || svc.category;
      if (idx.name >= 0) row[idx.name] = svc.name || '';
      if (idx.description >= 0) row[idx.description] = svc.description || svc.short_description || '';
      if (idx.price >= 0) row[idx.price] = svc.price != null ? String(svc.price) : '';
      if (idx.duration >= 0) row[idx.duration] = svc.duration || '';
      if (idx.active >= 0) row[idx.active] = svc.is_active === false ? 'No' : 'Yes';
      if (idx.audience >= 0) row[idx.audience] = svc.target_audience || '';
      return row;
    };

    const lastCol = String.fromCharCode(65 + numCols - 1);
    const updates = [];
    const appends = [];

    for (const svc of services) {
      const nameLower = (svc.name || '').toLowerCase();
      const row = makeRow(svc);
      if (existingRowsByName[nameLower]) {
        const sheetRow = existingRowsByName[nameLower];
        updates.push({
          range: `${tabName}!A${sheetRow}:${lastCol}${sheetRow}`,
          values: [row],
        });
      } else {
        appends.push(row);
      }
    }

    let updatedCount = 0;
    let appendedCount = 0;

    if (updates.length > 0) {
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SERVICES_SHEET_ID}/values:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
        }
      );
      if (!updateRes.ok) {
        const err = await updateRes.text();
        return Response.json({ error: 'Batch update failed', details: err }, { status: 500 });
      }
      updatedCount = updates.length;
    }

    if (appends.length > 0) {
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SERVICES_SHEET_ID}/values/${encodedTab}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: appends }),
        }
      );
      if (!appendRes.ok) {
        const err = await appendRes.text();
        return Response.json({ error: 'Append failed', details: err }, { status: 500 });
      }
      appendedCount = appends.length;
    }

    return Response.json({
      success: true,
      message: `Push complete: ${updatedCount} updated, ${appendedCount} appended to sheet`,
      updated: updatedCount,
      appended: appendedCount,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});