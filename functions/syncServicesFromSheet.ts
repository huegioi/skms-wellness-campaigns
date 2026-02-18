import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SERVICES_SHEET_ID = '1qYMjE_ZWwUVl3nFC4k4RGHLpmDCG8lg1hEY9cGZZ-P8';

const CATEGORY_MAP = {
  'workshop': 'workshop',
  'workshops': 'workshop',
  'challenge': 'challenge',
  'challenges': 'challenge',
  '14-day challenge': 'challenge',
  'leadership': 'leadership',
  'leadership program': 'leadership',
  'class': 'class',
  'classes': 'class',
  'wellness box': 'wellness_box',
  'wellness_box': 'wellness_box',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Fetch sheet data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SERVICES_SHEET_ID}/values/A1:Z1000`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: 'Failed to fetch sheet', details: err }, { status: 500 });
    }

    const sheetData = await response.json();
    const rows = sheetData.values || [];

    if (rows.length < 2) {
      return Response.json({ error: 'Sheet has no data rows' }, { status: 400 });
    }

    // First row = headers
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    // Map headers to indices
    const idx = {
      category: headers.findIndex(h => h.includes('category')),
      name: headers.findIndex(h => h.includes('title') || h.includes('name')),
      description: headers.findIndex(h => h.includes('description')),
      price: headers.findIndex(h => h.includes('price')),
      duration: headers.findIndex(h => h.includes('length') || h.includes('duration')),
      active: headers.findIndex(h => h.includes('active')),
      audience: headers.findIndex(h => h.includes('audience')),
    };

    // Load existing services
    const existingServices = await base44.asServiceRole.entities.Service.list();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of dataRows) {
      const get = (i) => (i >= 0 && row[i] !== undefined ? row[i].trim() : '');

      const name = get(idx.name);
      if (!name) { skipped++; continue; }

      const rawCategory = get(idx.category).toLowerCase();
      const category = CATEGORY_MAP[rawCategory] || 'workshop';

      const rawActive = get(idx.active).toLowerCase();
      const is_active = rawActive === '' || rawActive === 'yes' || rawActive === 'true' || rawActive === '1' || rawActive === 'active';

      const rawPrice = get(idx.price).replace(/[^0-9.]/g, '');
      const price = parseFloat(rawPrice) || 0;

      const serviceData = {
        name,
        category,
        description: get(idx.description),
        short_description: get(idx.description).slice(0, 150),
        price,
        duration: get(idx.duration),
        target_audience: get(idx.audience),
        is_active,
      };

      // Find existing by name + category
      const existing = existingServices.find(
        s => s.name.toLowerCase() === name.toLowerCase() && s.category === category
      );

      if (existing) {
        await base44.asServiceRole.entities.Service.update(existing.id, serviceData);
        updated++;
      } else {
        await base44.asServiceRole.entities.Service.create({ ...serviceData, sort_order: 0, key_benefits: [] });
        created++;
      }
    }

    return Response.json({
      success: true,
      message: `Sync complete: ${created} created, ${updated} updated, ${skipped} skipped`,
      created,
      updated,
      skipped
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});