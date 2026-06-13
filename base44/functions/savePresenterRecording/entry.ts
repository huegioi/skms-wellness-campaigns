import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
const SHEET_NAME = 'Events';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { portal_id, event_id, recording_link } = await req.json();

    if (!portal_id || !event_id) {
      return Response.json({ error: 'portal_id and event_id are required' }, { status: 400 });
    }

    // Verify the presenter owns this event
    const presenters = await base44.asServiceRole.entities.Presenter.filter({ unique_portal_id: portal_id });
    if (!presenters || presenters.length === 0) {
      return Response.json({ error: 'Presenter not found' }, { status: 404 });
    }
    const presenter = presenters[0];

    // Fetch the event
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = events[0];

    // Security: confirm this event belongs to this presenter
    const presenterFullName = (presenter.name || '').trim();
    const presenterFirstName = presenterFullName.split(' ')[0].toLowerCase();
    const eventPresenterName = (event.presenter || '').trim().toLowerCase();

    const ownsEvent =
      event.presenter_id === presenter.id ||
      eventPresenterName === presenterFullName.toLowerCase() ||
      (presenterFirstName && eventPresenterName === presenterFirstName);

    if (!ownsEvent) {
      return Response.json({ error: 'Forbidden: this event does not belong to your portal' }, { status: 403 });
    }

    // Save recording_link on the CalendarEvent
    await base44.asServiceRole.entities.CalendarEvent.update(event_id, { recording_link: recording_link || '' });

    // --- Write to Google Sheet ---
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // 1. Read the header row to find the "Loom Recording" column index
    const headerRange = `${SHEET_NAME}!1:1`;
    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(headerRange)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const headerData = await headerRes.json();
    const headers = (headerData.values && headerData.values[0]) || [];
    const loomColIndex = headers.findIndex(h => h.trim().toLowerCase() === 'loom recording');
    if (loomColIndex === -1) {
      return Response.json({ error: 'Column "Loom Recording" not found in sheet header' }, { status: 500 });
    }
    // Convert 0-based index to A1 column letter(s)
    const colLetter = indexToColumn(loomColIndex);

    // 2. Read enough columns to find the event row
    //    Col H = Event Name (index 7), Col A = Client (index 0)
    const eventNameColIndex = 7; // H
    const clientColIndex = 0;    // A
    const startDateColIndex = 5; // F — assumption; use as tiebreaker

    const dataRange = `${SHEET_NAME}!A2:Z`;
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(dataRange)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const dataData = await dataRes.json();
    const rows = (dataData.values) || [];

    const eventTitle = (event.title || '').toLowerCase().trim();
    const eventClientName = (event.client_name || '').toLowerCase().trim();
    const eventStartDate = event.start_date ? event.start_date.substring(0, 10) : '';

    // Find matching rows (rows array is 0-indexed; actual sheet row = index + 2)
    let candidates = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowTitle = (row[eventNameColIndex] || '').toLowerCase().trim();
      const rowClient = (row[clientColIndex] || '').toLowerCase().trim();
      if (rowTitle === eventTitle && (!eventClientName || rowClient === eventClientName)) {
        candidates.push({ rowIndex: i, row });
      }
    }

    // Tiebreak by start date if multiple matches
    let targetRowIndex = null;
    if (candidates.length === 1) {
      targetRowIndex = candidates[0].rowIndex;
    } else if (candidates.length > 1 && eventStartDate) {
      const dated = candidates.find(c => {
        const cell = (c.row[startDateColIndex] || '');
        return cell.includes(eventStartDate.substring(0, 7)); // match year-month
      });
      targetRowIndex = (dated || candidates[0]).rowIndex;
    } else if (candidates.length > 1) {
      targetRowIndex = candidates[0].rowIndex;
    }

    let sheetResult = null;
    if (targetRowIndex !== null) {
      const sheetRow = targetRowIndex + 2; // +1 for header, +1 for 1-based
      const cellRef = `${SHEET_NAME}!${colLetter}${sheetRow}`;
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(cellRef)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [[recording_link || '']] }),
        }
      );
      const updateData = await updateRes.json();
      sheetResult = { cell: cellRef, updatedCells: updateData.updatedCells };
    } else {
      sheetResult = { warning: 'No matching row found in sheet — only saved to database' };
    }

    return Response.json({ success: true, sheet: sheetResult });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function indexToColumn(index) {
  let col = '';
  let n = index;
  while (n >= 0) {
    col = String.fromCharCode((n % 26) + 65) + col;
    n = Math.floor(n / 26) - 1;
  }
  return col;
}