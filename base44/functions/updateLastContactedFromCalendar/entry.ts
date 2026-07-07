import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Shared multi-calendar watch list. Keep in sync with handleCalendarEventChange.
// Calendars must be shared with the connected Google account (read access).
// owner maps a calendar to the team member whose touches should be attributed.
const WATCHED_CALENDARS = [
  { id: 'primary', owner: 'William' },
  { id: 'heather@skillfulmeans.life', owner: 'Heather' },
  { id: 'admin@skillfulmeans.life', owner: null },
];

// Guarded substring match: one string must contain the other, and the
// contained string must be >5 chars to avoid false positives (e.g. "Call").
// Mirrors the rule from getClientPortalData.
function titleMatchesName(titleLower, nameLower) {
  if (!titleLower || !nameLower) return false;
  if (nameLower.length > 5 && titleLower.includes(nameLower)) return true;
  if (titleLower.length > 5 && nameLower.includes(titleLower)) return true;
  return false;
}

// Chunked bulkCreate (SDK limit: 500 per call)
async function batchBulkCreate(entity, records) {
  let total = 0;
  for (let i = 0; i < records.length; i += 500) {
    const result = await entity.bulkCreate(records.slice(i, i + 500));
    total += Array.isArray(result) ? result.length : 0;
  }
  return total;
}

// Chunked bulkUpdate (SDK limit: 500 per call)
async function batchBulkUpdate(entity, records) {
  let total = 0;
  for (let i = 0; i < records.length; i += 500) {
    await entity.bulkUpdate(records.slice(i, i + 500));
    total += Math.min(records.slice(i, i + 500).length, 500);
  }
  return total;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse optional body (backfill mode). Webhook/scheduled calls have no JSON body.
    let body = {};
    try { body = await req.json(); } catch { /* no JSON body */ }
    const backfillDays = body?.backfill_days || 0;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Lookback: 24h default (dedup by google_event_id makes this safe), or backfill_days
    const now = new Date();
    const lookbackMs = backfillDays > 0
      ? backfillDays * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
    const sinceStr = new Date(now.getTime() - lookbackMs).toISOString();

    // Load clients, leads, existing CalendarEvents, and interactions with a calendar link
    const [clients, leads, calEvents, recentInteractions] = await Promise.all([
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.Lead.list(),
      base44.asServiceRole.entities.CalendarEvent.list('-start_date', 500),
      base44.asServiceRole.entities.ClientInteraction.list('-date', 500),
    ]);

    // Index CalendarEvents by google_event_id (dedup + update lookup)
    const calEventByGoogleId = {};
    for (const ce of calEvents) {
      if (ce.google_event_id) calEventByGoogleId[ce.google_event_id] = ce;
    }

    // Set of calendar_event_ids that already have a logged interaction (dedup for Part B)
    const processedEventIds = new Set(
      (recentInteractions || []).filter(i => i.calendar_event_id).map(i => i.calendar_event_id)
    );

    // Build email → contact lookup indexes for attendee matching
    const leadByEmail = {};
    for (const lead of leads) {
      if (lead.email) leadByEmail[lead.email.toLowerCase().trim()] = lead;
    }
    const clientByEmail = {};
    for (const client of clients) {
      if (client.email) clientByEmail[client.email.toLowerCase().trim()] = client;
      if (client.email2) clientByEmail[client.email2.toLowerCase().trim()] = client;
    }

    // ── Fetch all watched calendars in parallel ──────────────────────────
    const calendarResults = await Promise.all(
      WATCHED_CALENDARS.map(async (cal) => {
        try {
          const params = new URLSearchParams({
            singleEvents: 'true',
            orderBy: backfillDays > 0 ? 'startTime' : 'updated',
            maxResults: '2500',
          });
          // Backfill: timeMin returns all events from that point forward (past + future).
          // Incremental: updatedMin returns events modified since that point (catches changes).
          if (backfillDays > 0) {
            params.set('timeMin', sinceStr);
          } else {
            params.set('updatedMin', sinceStr);
          }
          const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
            { headers: authHeader }
          );
          if (!calRes.ok) {
            console.error(`Calendar ${cal.id} API error: ${await calRes.text()}`);
            return { cal, events: [] };
          }
          const calData = await calRes.json();
          return { cal, events: calData.items || [] };
        } catch (e) {
          console.error(`Failed to fetch calendar ${cal.id}:`, e.message);
          return { cal, events: [] };
        }
      })
    );

    // ── PART A: Ingest events — collect creates/updates for batch execution ──
    const pendingCreatesByGid = {};  // dedup by google_event_id (shared events on multiple cals)
    const pendingUpdatesByCEId = {}; // dedup by CalendarEvent ID
    const clientBestDate = {};       // clientId → latest eventDateStr
    let eventsCancelled = 0;
    let unmatchedSkipped = 0;

    for (const { cal, events } of calendarResults) {
      for (const event of events) {
        const eventStart = event.start?.dateTime || event.start?.date;
        if (!eventStart) continue;
        const eventDate = new Date(eventStart);
        if (isNaN(eventDate.getTime())) continue;

        const isPast = eventDate <= now;
        const eventDateStr = eventDate.toISOString().split('T')[0];

        // Cancellation: delete the matching CalendarEvent
        if (event.status === 'cancelled') {
          if (event.id && calEventByGoogleId[event.id]) {
            await base44.asServiceRole.entities.CalendarEvent.delete(calEventByGoogleId[event.id].id);
            delete calEventByGoogleId[event.id];
            eventsCancelled++;
          }
          continue;
        }

        // Normalize event fields
        const title = event.summary || 'Untitled Event';
        const startISO = event.start?.dateTime
          || (event.start?.date ? new Date(event.start.date + 'T00:00:00').toISOString() : null);
        const endISO = event.end?.dateTime
          || (event.end?.date ? new Date(event.end.date + 'T00:00:00').toISOString() : null)
          || startISO;
        const location = event.hangoutLink || event.location || '';
        const summaryLower = title.toLowerCase();
        const attendeeEmails = (event.attendees || [])
          .map(a => a.email?.toLowerCase().trim())
          .filter(Boolean);

        // Match to contact: (a) lead email → lead_id, (b) client email/email2 → client_id,
        // (c) fallback: title substring match (>5 chars) against lead/client names
        let matchedLead = null;
        let matchedClient = null;

        for (const email of attendeeEmails) {
          if (leadByEmail[email]) { matchedLead = leadByEmail[email]; break; }
        }
        if (!matchedLead) {
          for (const email of attendeeEmails) {
            if (clientByEmail[email]) { matchedClient = clientByEmail[email]; break; }
          }
        }
        if (!matchedLead && !matchedClient) {
          for (const lead of leads) {
            if (titleMatchesName(summaryLower, (lead.name || '').toLowerCase()) ||
                titleMatchesName(summaryLower, (lead.company || '').toLowerCase())) {
              matchedLead = lead; break;
            }
          }
        }
        if (!matchedLead && !matchedClient) {
          for (const client of clients) {
            if (titleMatchesName(summaryLower, (client.name || '').toLowerCase()) ||
                titleMatchesName(summaryLower, (client.company || '').toLowerCase())) {
              matchedClient = client; break;
            }
          }
        }

        // Find existing CalendarEvent by google_event_id
        const existingCE = event.id ? calEventByGoogleId[event.id] : null;

        if (existingCE) {
          // Collect update if time/title/location changed or source_calendar missing
          const updatePayload = { id: existingCE.id };
          let changed = false;
          if (existingCE.title !== title) { updatePayload.title = title; changed = true; }
          if (startISO && existingCE.start_date !== startISO) { updatePayload.start_date = startISO; changed = true; }
          if (endISO && existingCE.end_date !== endISO) { updatePayload.end_date = endISO; changed = true; }
          if (location && existingCE.location !== location) { updatePayload.location = location; changed = true; }
          if (!existingCE.source_calendar) { updatePayload.source_calendar = cal.id; changed = true; }
          if (changed) pendingUpdatesByCEId[existingCE.id] = updatePayload;
        } else if (matchedLead || matchedClient) {
          // Collect create (dedup by google_event_id for shared events across calendars)
          if (!event.id || !pendingCreatesByGid[event.id]) {
            const createData = {
              title,
              description: event.description || '',
              location,
              start_date: startISO,
              end_date: endISO,
              all_day: !event.start?.dateTime,
              event_type: 'meeting',
              google_event_id: event.id || undefined,
              source_calendar: cal.id,
              lead_id: matchedLead?.id || undefined,
              client_id: matchedClient?.id || undefined,
              client_name: matchedLead?.name || matchedClient?.name || '',
            };
            if (event.id) {
              pendingCreatesByGid[event.id] = createData;
            } else {
              pendingCreatesByGid[`__noid_${cal.id}_${eventStart}`] = createData;
            }
          }
        } else {
          unmatchedSkipped++;
          continue; // no contact match — skip
        }

        // Track best last_contacted_date for matched clients (past events only)
        if (isPast && matchedClient) {
          const existing = clientBestDate[matchedClient.id];
          if (!existing || eventDateStr > existing) {
            clientBestDate[matchedClient.id] = eventDateStr;
          }
        }
      }
    }

    // ── Execute batch creates and updates ────────────────────────────────
    const pendingCreates = Object.values(pendingCreatesByGid);
    const pendingUpdates = Object.values(pendingUpdatesByCEId);

    const eventsCreated = pendingCreates.length > 0
      ? await batchBulkCreate(base44.asServiceRole.entities.CalendarEvent, pendingCreates)
      : 0;
    const eventsUpdated = pendingUpdates.length > 0
      ? await batchBulkUpdate(base44.asServiceRole.entities.CalendarEvent, pendingUpdates)
      : 0;

    // Update last_contacted_date for clients (deduped by max date)
    let clientsUpdated = 0;
    const clientById = {};
    for (const c of clients) clientById[c.id] = c;
    for (const [clientId, dateStr] of Object.entries(clientBestDate)) {
      const client = clientById[clientId];
      if (client && (!client.last_contacted_date || dateStr > client.last_contacted_date)) {
        await base44.asServiceRole.entities.Client.update(clientId, { last_contacted_date: dateStr });
        clientsUpdated++;
      }
    }

    // ── PART B: Process lead-linked events that have ended ───────────────
    // Once the event is in the past, log a meeting Interaction (dated at event start)
    // and set the lead's last_contacted_date to the event date.
    const ownerByCalendar = {};
    for (const c of WATCHED_CALENDARS) ownerByCalendar[c.id] = c.owner;
    const leadById = {};
    for (const l of leads) leadById[l.id] = l;

    const pendingInteractions = [];
    const leadBestDate = {};

    for (const ce of calEvents) {
      if (!ce.lead_id || !ce.start_date) continue;
      const start = new Date(ce.start_date);
      if (isNaN(start.getTime()) || start > now) continue; // only past events
      if (processedEventIds.has(ce.id)) continue; // already logged

      const owner = ce.source_calendar ? ownerByCalendar[ce.source_calendar] : null;
      pendingInteractions.push({
        lead_id: ce.lead_id,
        channel: 'meeting',
        interaction_type: 'meeting',
        subject: ce.title || 'Meeting',
        calendar_event_id: ce.id,
        date: ce.start_date,
        owner: owner || undefined,
      });

      const eventDateStr = start.toISOString().split('T')[0];
      if (!leadBestDate[ce.lead_id] || eventDateStr > leadBestDate[ce.lead_id]) {
        leadBestDate[ce.lead_id] = eventDateStr;
      }
    }

    const interactionsCreated = pendingInteractions.length > 0
      ? await batchBulkCreate(base44.asServiceRole.entities.ClientInteraction, pendingInteractions)
      : 0;

    // Update lead last_contacted_date (batch)
    let leadsUpdated = 0;
    const leadUpdates = [];
    for (const [leadId, dateStr] of Object.entries(leadBestDate)) {
      const lead = leadById[leadId];
      if (lead && (!lead.last_contacted_date || dateStr > lead.last_contacted_date)) {
        leadUpdates.push({ id: leadId, last_contacted_date: dateStr });
      }
    }
    if (leadUpdates.length > 0) {
      leadsUpdated = await batchBulkUpdate(base44.asServiceRole.entities.Lead, leadUpdates);
    }

    return Response.json({
      message: backfillDays > 0 ? `Backfill complete (${backfillDays}d + future)` : 'Processed',
      mode: backfillDays > 0 ? 'backfill' : 'incremental',
      calendarsWatched: WATCHED_CALENDARS.length,
      eventsCreated,
      eventsUpdated,
      eventsCancelled,
      unmatchedSkipped,
      clientsUpdated,
      interactionsCreated,
      leadsUpdated,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});