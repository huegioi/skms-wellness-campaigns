import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';

// ── Helpers ──

/** Derive event_type from title + sheet tab using keyword classification. */
function deriveEventType(title: string, sheetName: string): string {
  const lower = `${title || ''} ${sheetName || ''}`.toLowerCase();
  if (lower.includes('challenge')) return 'challenge';
  if (lower.includes('workshop')) return 'workshop';
  if (lower.includes('leadership') || lower.includes('leader')) return 'leadership';
  if (lower.includes('class') || lower.includes('movement')) return 'class';
  if (lower.includes('presentation') || lower.includes('lunch & learn') || lower.includes('lunch and learn')) return 'presentation';
  if (lower.includes('follow')) return 'follow_up';
  if (lower.includes('meeting') || lower.includes('call') || lower.includes('sync')) return 'meeting';
  return 'other';
}

/** Deterministic hash (djb2) of sheet tab + title + date → stable sheet_key. */
function computeSheetKey(sheetTab: string, title: string, dateStr: string): string {
  const raw = `${sheetTab}|${(title || '').toLowerCase().trim()}|${dateStr}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return `sheet_${(hash >>> 0).toString(36)}`;
}

/** Guarded substring title match — shorter must be >5 chars and contained in longer. */
function titlesMatch(t1: string, t2: string): boolean {
  const a = (t1 || '').toLowerCase().trim();
  const b = (t2 || '').toLowerCase().trim();
  if (a === b && a.length > 0) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return shorter.length > 5 && longer.includes(shorter);
}

/** Match a sheet row's client/company field against Client records (guarded). */
function matchClient(clientName: string, clients: any[]): any | null {
  if (!clientName || clientName.trim().length < 3) return null;
  const lower = clientName.toLowerCase().trim();
  // Exact match
  for (const c of clients) {
    if ((c.name || '').toLowerCase() === lower || (c.company || '').toLowerCase() === lower) return c;
  }
  // Guarded substring match (>5 chars)
  if (lower.length > 5) {
    for (const c of clients) {
      const cName = (c.name || '').toLowerCase();
      const cCompany = (c.company || '').toLowerCase();
      if (cName.length > 5 && (lower.includes(cName) || cName.includes(lower))) return c;
      if (cCompany.length > 5 && (lower.includes(cCompany) || cCompany.includes(lower))) return c;
    }
  }
  return null;
}

/** Format a Date as local ISO string (no timezone shift). */
function formatLocalAsISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

/** Parse sheet data into upcoming event objects (mirrors SchedulingHub.parseSheetEvents). */
function parseSheetEvents(sheets: any[]): any[] {
  const events: any[] = [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  for (const sheet of sheets) {
    for (const row of (sheet.data || [])) {
      // Find date column
      let dateValue: string | null = null;
      for (const [key, value] of Object.entries(row)) {
        const keyLower = key.toLowerCase();
        if ((keyLower.includes('date') || keyLower.includes('day') || keyLower === 'when') && value && String(value).trim() !== '') {
          dateValue = String(value);
          break;
        }
      }
      if (!dateValue || dateValue.trim() === '') continue;

      // Parse date
      let eventDate: Date;
      try {
        eventDate = new Date(dateValue);
        if (isNaN(eventDate.getTime())) {
          const parts = dateValue.split('/');
          if (parts.length === 3) {
            eventDate = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
          }
        }
        if (isNaN(eventDate.getTime())) continue;
      } catch {
        continue;
      }

      // Only upcoming
      if (eventDate < startOfToday) continue;

      // Find title
      let title = 'Untitled Event';
      for (const [key, value] of Object.entries(row)) {
        const keyLower = key.toLowerCase();
        if ((keyLower.includes('event') || keyLower.includes('service') || keyLower.includes('title') || keyLower.includes('name')) && value) {
          title = String(value);
          break;
        }
      }

      // Find other fields
      const findVal = (...keywords: string[]): string => {
        for (const [key, value] of Object.entries(row)) {
          const keyLower = key.toLowerCase().trim();
          if (keywords.some(kw => keyLower === kw || keyLower.includes(kw)) && value && String(value).trim() !== '') {
            return String(value);
          }
        }
        return '';
      };

      // Parse time
      const timeStr = findVal('time');
      if (timeStr && timeStr.trim() !== '') {
        const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeParts) {
          let hours = parseInt(timeParts[1]);
          const minutes = parseInt(timeParts[2]);
          const period = timeParts[3];
          if (period && period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
          else if (period && period.toUpperCase() === 'AM' && hours === 12) hours = 0;
          eventDate.setHours(hours, minutes, 0, 0);
        }
      } else {
        const isChallenge = (sheet.name || '').toLowerCase().includes('challenge');
        eventDate.setHours(isChallenge ? 8 : 9, 0, 0, 0);
      }

      const endDate = new Date(eventDate);
      endDate.setHours(eventDate.getHours() + 1);

      const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;

      events.push({
        title,
        sheetTab: sheet.name,
        sheetKey: computeSheetKey(sheet.name, title, dateStr),
        startDate: formatLocalAsISO(eventDate),
        endDate: formatLocalAsISO(endDate),
        dateStr,
        client: findVal('client', 'payee', 'company'),
        location: findVal('location', 'venue', 'place', 'address'),
        presenter: findVal('presenter', 'facilitator', 'speaker'),
        meetingLink: findVal('link to host', 'host video', 'host link'),
        recording: findVal('recording', 'need recording'),
        translation: findVal('translation', 'need translation'),
      });
    }
  }

  return events;
}

// ── Main handler ──


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Team only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const windowDays: number = body.window_days || 30;

    // ── Fetch sheet data ──
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=properties.title,sheets.properties.title`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!metaResponse.ok) {
      const error = await metaResponse.text();
      return Response.json({ error: `Failed to fetch sheet metadata: ${error}` }, { status: 500 });
    }
    const meta = await metaResponse.json();
    const sheetNames: string[] = meta.sheets.map((s: any) => s.properties.title);

    const ranges = sheetNames.map(name => encodeURIComponent(name));
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${ranges.join('&ranges=')}&valueRenderOption=FORMATTED_VALUE`;
    const batchResponse = await fetch(batchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!batchResponse.ok) {
      const error = await batchResponse.text();
      return Response.json({ error: `Failed to fetch sheet values: ${error}` }, { status: 500 });
    }
    const batchData = await batchResponse.json();

    // Process sheets (same logic as syncGoogleSheets)
    const allSheets = (batchData.valueRanges || []).map((vr: any, i: number) => {
      const rows = vr.values || [];
      const name = sheetNames[i];
      if (rows.length === 0) return { name, headers: [], data: [], headerRowIndex: 0 };

      let headerRowIndex = -1;
      let headers: string[] = [];
      for (let r = 0; r < Math.min(10, rows.length); r++) {
        const nonEmpty = (rows[r] || []).filter((c: any) => c && c.toString().trim() !== '');
        if (nonEmpty.length >= 2) {
          headers = rows[r];
          headerRowIndex = r;
          break;
        }
      }
      if (headerRowIndex === -1) return { name, headers: [], data: [], headerRowIndex: 0 };

      const cleanHeaders = headers.map((h: any) => (h || '').toString().trim());
      const data = rows.slice(headerRowIndex + 1).map((row: any[]) => {
        const rowData: Record<string, string> = {};
        let hasData = false;
        cleanHeaders.forEach((header, idx) => {
          if (!header) return;
          const val = (row[idx] || '').toString();
          if (val) hasData = true;
          rowData[header] = val;
        });
        return hasData ? rowData : null;
      }).filter((r: any) => r !== null);

      return { name, headers: cleanHeaders.filter((h: string) => h), data, headerRowIndex };
    });

    // ── Parse sheet events ──
    const sheetEvents = parseSheetEvents(allSheets);

    // Filter by window (upcoming only, within window_days)
    const now = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    const upcomingSheetEvents = sheetEvents.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= now && eventDate <= windowEnd;
    });

    // ── Fetch existing CalendarEvents + Clients ──
    const existingEvents = await base44.asServiceRole.entities.CalendarEvent.list('-start_date', 500);
    const clients = await base44.asServiceRole.entities.Client.list('name', 500);

    // Build sheet_key index
    const sheetKeyIndex: Record<string, any> = {};
    for (const ev of existingEvents) {
      if (ev.sheet_key) {
        sheetKeyIndex[ev.sheet_key] = ev;
      }
    }

    // Fuzzy match candidates: non-sheet events (app/Google)
    const fuzzyCandidates = existingEvents.filter((ev: any) => ev.source_calendar !== 'sheet');

    const created: any[] = [];
    const matched: any[] = [];
    const updated: any[] = [];
    const skipped: any[] = [];
    const seenSheetKeys = new Set<string>();

    for (const sheetEvent of upcomingSheetEvents) {
      seenSheetKeys.add(sheetEvent.sheetKey);

      // (a) Match by sheet_key → update if changed
      const sheetKeyMatch = sheetKeyIndex[sheetEvent.sheetKey];
      if (sheetKeyMatch) {
        const startDateChanged = new Date(sheetKeyMatch.start_date).getTime() !== new Date(sheetEvent.startDate).getTime();
        const titleChanged = sheetKeyMatch.title !== sheetEvent.title;
        const locationChanged = (sheetKeyMatch.location || '') !== (sheetEvent.location || sheetEvent.meetingLink || '');

        if (startDateChanged || titleChanged || locationChanged) {
          const matchedClient = matchClient(sheetEvent.client, clients);
          await base44.asServiceRole.entities.CalendarEvent.update(sheetKeyMatch.id, {
            title: sheetEvent.title,
            start_date: sheetEvent.startDate,
            end_date: sheetEvent.endDate,
            location: sheetEvent.location || sheetEvent.meetingLink || sheetKeyMatch.location,
            meeting_link: sheetEvent.meetingLink || sheetKeyMatch.meeting_link,
            presenter: sheetEvent.presenter || sheetKeyMatch.presenter,
            client_name: sheetEvent.client || sheetKeyMatch.client_name,
            client_id: matchedClient?.id || sheetKeyMatch.client_id,
          });
          updated.push({ title: sheetEvent.title, date: sheetEvent.startDate, id: sheetKeyMatch.id });
        } else {
          matched.push({ title: sheetEvent.title, date: sheetEvent.startDate, id: sheetKeyMatch.id });
        }
        continue;
      }

      // (b) Fuzzy match against existing non-sheet events (same date + similar title)
      const sheetDateStr = sheetEvent.dateStr;
      let fuzzyMatched: any = null;
      for (const ev of fuzzyCandidates) {
        const evDate = new Date(ev.start_date);
        const evDateStr = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`;
        if (evDateStr !== sheetDateStr) continue;
        if (titlesMatch(sheetEvent.title, ev.title)) {
          fuzzyMatched = ev;
          break;
        }
      }

      if (fuzzyMatched) {
        skipped.push({ title: sheetEvent.title, date: sheetEvent.startDate, reason: 'fuzzy matched existing event', matched_title: fuzzyMatched.title, id: fuzzyMatched.id });
        continue;
      }

      // (c) Create new mirrored CalendarEvent
      const matchedClient = matchClient(sheetEvent.client, clients);
      const eventType = deriveEventType(sheetEvent.title, sheetEvent.sheetTab);

      let description = `Client: ${sheetEvent.client || 'N/A'}\nSource: ${sheetEvent.sheetTab} (auto-mirrored)`;
      if (sheetEvent.recording) description += `\nRecording: ${sheetEvent.recording}`;
      if (sheetEvent.translation) description += `\nTranslation: ${sheetEvent.translation}`;

      const newEvent = await base44.asServiceRole.entities.CalendarEvent.create({
        title: sheetEvent.title,
        description,
        start_date: sheetEvent.startDate,
        end_date: sheetEvent.endDate,
        all_day: false,
        event_type: eventType,
        source_calendar: 'sheet',
        sheet_key: sheetEvent.sheetKey,
        checkin_token: crypto.randomUUID(),
        location: sheetEvent.location || sheetEvent.meetingLink || '',
        meeting_link: sheetEvent.meetingLink || '',
        client_name: sheetEvent.client || '',
        client_id: matchedClient?.id || '',
        presenter: sheetEvent.presenter || '',
        color: '#264d44',
        ingested: false,
        is_demo: false,
      });

      created.push({ title: sheetEvent.title, date: sheetEvent.startDate, id: newEvent.id, event_type: eventType, client_linked: !!matchedClient });
    }

    // ── Handle removals: upcoming sheet-mirrored events whose sheet_key is gone ──
    const removed: any[] = [];
    const keptWithCheckins: any[] = [];

    for (const ev of existingEvents) {
      if (ev.source_calendar !== 'sheet' || !ev.sheet_key) continue;
      if (seenSheetKeys.has(ev.sheet_key)) continue; // still in sheet

      // Only check upcoming events
      const evDate = new Date(ev.start_date);
      if (evDate < now) continue;

      // Check for check-ins
      const checkins = await base44.asServiceRole.entities.EventCheckin.filter({ event_id: ev.id });

      if (checkins.length === 0) {
        await base44.asServiceRole.entities.CalendarEvent.delete(ev.id);
        removed.push({ title: ev.title, date: ev.start_date, id: ev.id });
      } else {
        // Keep but flag
        const currentDesc = ev.description || '';
        if (!currentDesc.includes('[Removed from sheet]')) {
          await base44.asServiceRole.entities.CalendarEvent.update(ev.id, {
            description: `[Removed from sheet — ${checkins.length} check-in(s) preserved]\n${currentDesc}`
          });
        }
        keptWithCheckins.push({ title: ev.title, date: ev.start_date, id: ev.id, checkin_count: checkins.length });
      }
    }

    // ── Backfill checkin tokens for any upcoming events still missing them ──
    // Skip events with assessment_timing === 'none' — a token there marks an
    // attendee present with no survey (attendance-only with no survey is never
    // intentional). Events with null/unset timing still get a token (normal
    // state for a workshop before timing is computed).
    let tokensBackfilled = 0;
    let tokensSkipped = 0;
    for (const ev of existingEvents) {
      if (!ev.is_demo && !ev.checkin_token && ev.start_date && new Date(ev.start_date) >= now) {
        if (ev.assessment_timing === 'none') {
          console.log(`[mirrorSheetEvents] Skipping token backfill — assessment_timing is 'none': ${ev.id} "${ev.title}"`);
          tokensSkipped++;
          continue;
        }
        await base44.asServiceRole.entities.CalendarEvent.update(ev.id, { checkin_token: crypto.randomUUID() });
        tokensBackfilled++;
      }
    }

    return Response.json({
      success: true,
      window_days: windowDays,
      sheet_events_parsed: sheetEvents.length,
      upcoming_in_window: upcomingSheetEvents.length,
      created: created.length,
      created_details: created,
      matched: matched.length,
      matched_details: matched,
      updated: updated.length,
      updated_details: updated,
      skipped: skipped.length,
      skipped_details: skipped,
      removed: removed.length,
      removed_details: removed,
      kept_with_checkins: keptWithCheckins.length,
      kept_with_checkins_details: keptWithCheckins,
      tokens_backfilled: tokensBackfilled,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});