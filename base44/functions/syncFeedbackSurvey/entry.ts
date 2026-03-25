import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SHEET_ID = '1rf6WQEY8qeRzQuTxd3-XAjP177yRBGM6d8YOwz68w5k';
const SHEET_TAB = 'Wellness Workshop feedback';

// Map column headers to question types
function inferQuestionType(header) {
  const h = header.toLowerCase();
  if (h.includes('mailing address') || h.includes('raffle')) return 'raffle_address';
  if (h.includes('how likely') || h.includes('recommend')) return 'rating_10';
  if (h.includes('how effective') || h.includes('how satisfied') || h.includes('how confident') || h.includes('how would you rate')) return 'rating_5';
  if (h.includes('did you') || h.includes('do you feel') || h.includes('do you have')) return 'boolean';
  if (h.includes('what') || h.includes('were there') || h.includes('additional comments') || h.includes('key take')) return 'long_text';
  return 'short_text';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Fetch the sheet data
    const encodedTab = encodeURIComponent(SHEET_TAB);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodedTab}!1:3`;
    const sheetRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!sheetRes.ok) {
      const err = await sheetRes.text();
      return Response.json({ error: 'Failed to fetch sheet', details: err }, { status: 500 });
    }

    const sheetData = await sheetRes.json();
    const rows = sheetData.values || [];

    if (rows.length === 0) {
      return Response.json({ error: 'No data found in sheet' }, { status: 400 });
    }

    const headers = rows[0];

    // Fixed columns that are metadata, not survey questions
    const metaColumns = ['full name', 'name of company', 'email address', 'timestamp', 'service name', 'thank you for your valuable feedback!'];

    // Find the "Service Name" column index
    const serviceNameColIdx = headers.findIndex(h => h.toLowerCase().trim() === 'service name');

    // Collect unique service names from data rows (rows 1+)
    const serviceNames = new Set();
    if (serviceNameColIdx !== -1 && rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const val = (rows[i][serviceNameColIdx] || '').trim();
        if (val) serviceNames.add(val);
      }
    }

    // Build questions from headers (excluding meta columns)
    const questions = [];
    headers.forEach((header, idx) => {
      const h = header.toLowerCase().trim();
      if (!metaColumns.some(m => h.includes(m)) && header.trim() !== '') {
        questions.push({
          id: `q_${idx}`,
          text: header.trim(),
          type: inferQuestionType(header)
        });
      }
    });

    // Get existing surveys
    const existingSurveys = await base44.asServiceRole.entities.FeedbackSurvey.list();

    let created = 0;
    let updated = 0;

    // If no service names found in data, create/update one generic survey for this tab
    const namesToProcess = serviceNames.size > 0 ? Array.from(serviceNames) : ['Wellness Workshop'];

    for (const serviceName of namesToProcess) {
      const existing = existingSurveys.find(s => s.service_name === serviceName && s.sheet_tab === SHEET_TAB);
      const surveyData = {
        service_name: serviceName,
        sheet_tab: SHEET_TAB,
        questions,
        is_active: true,
        last_synced: new Date().toISOString()
      };

      if (existing) {
        await base44.asServiceRole.entities.FeedbackSurvey.update(existing.id, surveyData);
        updated++;
      } else {
        await base44.asServiceRole.entities.FeedbackSurvey.create(surveyData);
        created++;
      }
    }

    return Response.json({
      success: true,
      message: `Sync complete: ${created} created, ${updated} updated`,
      questions_found: questions.length,
      services_found: namesToProcess
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});