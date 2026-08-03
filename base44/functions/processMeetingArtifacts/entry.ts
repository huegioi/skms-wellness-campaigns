import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Works headless (scheduled) — all operations use service role.
    try { await base44.auth.me(); } catch { /* headless — ok */ }

    // Parse optional payload for backfill mode.
    let backfillDays = null;
    try {
      const body = await req.json();
      if (body && typeof body.backfill_days === 'number') {
        backfillDays = body.backfill_days;
      }
    } catch { /* no body or not JSON — normal scheduled run */ }

    const now = Date.now();
    const lookbackMs = backfillDays
      ? backfillDays * 24 * 60 * 60 * 1000
      : 48 * 60 * 60 * 1000;
    const cutoff = new Date(now - lookbackMs).toISOString();

    // Fetch CalendarEvents in the lookback window. For backfill mode (large
    // windows), paginate via start_date cursor since a single page is capped.
    const events = [];
    const pageSize = 200;
    let cursor = null; // start_date upper bound for the next page
    const maxPages = backfillDays ? 20 : 1; // up to 4000 events for backfill

    for (let page = 0; page < maxPages; page++) {
      const query = { start_date: { $gte: cutoff } };
      if (cursor) query.start_date.$lt = cursor;
      const batch = await base44.asServiceRole.entities.CalendarEvent.filter(
        query, '-start_date', pageSize
      );
      if (!batch || batch.length === 0) break;
      events.push(...batch);
      if (batch.length < pageSize) break; // no more pages
      cursor = batch[batch.length - 1].start_date; // oldest in this batch
    }

    // Filter candidates: ended within lookback window, has google_event_id,
    // from a watched calendar (not 'sheet'), linked to a contact, not demo.
    const candidates = events.filter(e => {
      if (e.is_demo) return false;
      if (!e.google_event_id) return false;
      if (!e.source_calendar || e.source_calendar === 'sheet') return false;
      if (!e.lead_id && !e.client_id && !e.referral_partner_id) return false;
      const endRef = e.end_date ? new Date(e.end_date) : new Date(e.start_date);
      if (isNaN(endRef.getTime())) return false;
      if (endRef < new Date(cutoff)) return false;
      if (endRef > new Date(now)) return false; // hasn't ended yet
      return true;
    });

    if (candidates.length === 0) {
      return Response.json({
        status: 'ok', mode: backfillDays ? `backfill_${backfillDays}d` : 'scheduled',
        message: 'No candidate events', processed: 0, inaccessible: 0, skipped: 0,
        skipped_no_attachment: 0, skipped_already_captured: 0,
        matched_via_drive: 0, drive_ambiguous: 0, driveIndexSize: 0,
        driveCaptures: [], inaccessibleDocs: []
      });
    }

    // Get connector access tokens
    const { accessToken: calendarToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const { accessToken: driveToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    const NOTE_PATTERNS = ['notes by gemini', 'meeting notes', 'transcript'];
    const isNotesDoc = (title) => {
      if (!title) return false;
      const lower = title.toLowerCase();
      return NOTE_PATTERNS.some(p => lower.includes(p));
    };

    // ── Part 1: Build a Drive index of "Notes by Gemini" docs once per run.
    // This is the fallback source when a calendar event has no attachments. ──
    const driveIndex = []; // { id, name, createdTime, webViewLink, owners }
    const DRIVE_MAX = 1000;
    try {
      let pageToken = null;
      for (let i = 0; i < 20; i++) { // 20 pages × 200 = 4000, but 1000 hard cap
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', "name contains 'Notes by Gemini' and mimeType = 'application/vnd.google-apps.document' and trashed = false");
        url.searchParams.set('fields', 'files(id,name,createdTime,webViewLink,owners),nextPageToken');
        url.searchParams.set('orderBy', 'createdTime desc');
        url.searchParams.set('pageSize', '200');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const dRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (!dRes.ok) { console.warn(`Drive index query HTTP ${dRes.status}`); break; }
        const dData = await dRes.json();
        const items = dData.files || [];
        driveIndex.push(...items);
        if (driveIndex.length >= DRIVE_MAX) { driveIndex.length = DRIVE_MAX; break; }
        if (!dData.nextPageToken || items.length === 0) break;
        pageToken = dData.nextPageToken;
      }
    } catch (e) {
      console.warn('Drive index build failed:', e.message);
    }

    // ── Timestamp parsing for Drive-fallback matching ──
    // Gemini names docs "<session> - YYYY/MM/DD HH:MM TZ - Notes by Gemini".
    // The session name rarely matches the calendar event title, but the
    // embedded timestamp is the Meet session start (when the first participant
    // joined — typically a few minutes early).
    const TZ_ADD_MIN = {
      EDT: 240, EST: 300, CDT: 300, CST: 360, MDT: 360, MST: 420,
      PDT: 420, PST: 480, AKDT: 480, AKST: 540, HDT: 540, HST: 600,
      UTC: 0, GMT: 0, Z: 0,
    };
    const TS_RE = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s+([A-Z]{2,4})/;
    // Parse the embedded session-start timestamp. Returns null if it doesn't
    // parse (or the TZ abbreviation is unknown) — caller falls back to createdTime.
    const parseSessionStart = (name) => {
      const m = (name || '').match(TS_RE);
      if (!m) return null;
      const add = TZ_ADD_MIN[m[6]];
      if (add === undefined) return null; // unknown TZ — can't reliably convert
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + add * 60 * 1000);
      return isNaN(d.getTime()) ? null : d;
    };
    // Recover the <session> portion (everything before the timestamp segment).
    const sessionName = (name) => (name || '').replace(/\s*-\s*\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+[A-Z]{2,4}.*$/i, '').trim() || (name || '');
    const wordSet = (s) => new Set((s || '').toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean));
    const titleOverlap = (eventTitle, docSession) => {
      const a = wordSet(eventTitle), b = wordSet(docSession);
      let n = 0;
      for (const w of a) if (b.has(w)) n++;
      return n;
    };

    // Index stats for observability (reported in the response).
    let driveIndexParseable = 0;
    let driveIndexInAnyWindow = 0;
    const candidateStarts = candidates
      .map(c => new Date(c.start_date))
      .filter(d => !isNaN(d.getTime()));
    for (const f of driveIndex) {
      const ts = parseSessionStart(f.name);
      if (ts) driveIndexParseable++;
      const ref = ts || (f.createdTime ? new Date(f.createdTime) : null);
      if (ref && !isNaN(ref.getTime())) {
        for (const cs of candidateStarts) {
          if (Math.abs(ref.getTime() - cs.getTime()) <= 30 * 60 * 1000) {
            driveIndexInAnyWindow++;
            break;
          }
        }
      }
    }

    // ── Shared capture path (calendar-attachment and Drive-search both use it).
    // Returns { status: 'processed' | 'inaccessible' | 'already_captured', inaccessibleDoc? } ──
    const captureFromDoc = async ({ evt, docId, docTitle, docUrl, organizerEmail, captureSource }) => {
      // Dedup by doc_id — skip if already captured, but re-attempt if inaccessible
      const existing = await base44.asServiceRole.entities.MeetingNote.filter({ doc_id: docId }, '-created_date', 1);
      const existingNote = existing[0];
      if (existingNote && existingNote.access_status === 'captured') {
        return { status: 'already_captured' };
      }

      // Try to export the doc as plain text via Google Drive
      let fullText = '';
      let accessible = false;
      try {
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${driveToken}` } }
        );
        if (exportRes.ok) {
          fullText = await exportRes.text();
          accessible = true;
        } else if (exportRes.status === 404) {
          const dlRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${docId}?alt=media`,
            { headers: { Authorization: `Bearer ${driveToken}` } }
          );
          if (dlRes.ok) {
            fullText = await dlRes.text();
            accessible = true;
          }
        }
      } catch (e) {
        console.warn(`Drive export failed for doc ${docId}:`, e.message);
      }

      const capturedAt = new Date().toISOString();

      if (!accessible) {
        // Still inaccessible — create record only if none exists
        if (!existingNote) {
          await base44.asServiceRole.entities.MeetingNote.create({
            event_id: evt.id,
            lead_id: evt.lead_id || null,
            client_id: evt.client_id || null,
            referral_partner_id: evt.referral_partner_id || null,
            doc_url: docUrl,
            doc_id: docId,
            doc_title: docTitle || '',
            full_text: '',
            summary: '',
            organizer_email: organizerEmail,
            access_status: 'inaccessible',
            capture_source: captureSource,
            meeting_title: evt.title || '',
            meeting_date: evt.start_date || null,
            captured_at: capturedAt,
            is_demo: false,
          });
        }
        return {
          status: 'inaccessible',
          inaccessibleDoc: {
            meetingTitle: evt.title || '',
            meetingDate: evt.start_date || '',
            organizerEmail,
            docTitle: docTitle || '',
            docUrl,
            hint: `Doc not shared with the connected account — ask ${organizerEmail || 'the organizer'} to share their Meet Recordings folder.`,
          },
        };
      }

      // Generate 5-8 bullet summary via InvokeLLM
      let summary = '';
      try {
        const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Summarize the following meeting notes into 5 to 8 concise bullet points. Cover key points discussed, any client concerns raised, commitments made, and agreed next steps. Use bullet format (• prefix).\n\nMeeting: ${evt.title || 'Untitled'}\nDate: ${evt.start_date || 'Unknown'}\n\n--- NOTES ---\n${fullText.substring(0, 8000)}`,
        });
        summary = typeof llmRes === 'string' ? llmRes : (llmRes?.response || llmRes?.output || String(llmRes || ''));
      } catch (e) {
        console.warn(`LLM summary failed for doc ${docId}:`, e.message);
        summary = '(Summary generation failed — see full notes.)';
      }

      // Create or update MeetingNote record (update if previously inaccessible)
      const notePayload = {
        event_id: evt.id,
        lead_id: evt.lead_id || null,
        client_id: evt.client_id || null,
        referral_partner_id: evt.referral_partner_id || null,
        doc_url: docUrl,
        doc_id: docId,
        doc_title: docTitle || '',
        full_text: fullText.substring(0, 30000),
        summary,
        organizer_email: organizerEmail,
        access_status: 'captured',
        capture_source: captureSource,
        meeting_title: evt.title || '',
        meeting_date: evt.start_date || null,
        captured_at: capturedAt,
        is_demo: false,
      };

      let note;
      if (existingNote) {
        note = await base44.asServiceRole.entities.MeetingNote.update(existingNote.id, notePayload);
      } else {
        note = await base44.asServiceRole.entities.MeetingNote.create(notePayload);
      }

      // Create Interaction (channel: meeting) — skip if already linked from prior capture
      if (!existingNote?.interaction_id) {
        try {
          const interaction = await base44.asServiceRole.entities.ClientInteraction.create({
            lead_id: evt.lead_id || null,
            client_id: evt.client_id || null,
            referral_partner_id: evt.referral_partner_id || null,
            calendar_event_id: evt.id,
            interaction_type: 'meeting',
            channel: 'meeting',
            date: evt.start_date || capturedAt,
            subject: `Meeting notes — ${evt.title || 'Untitled'}`,
            notes: summary,
            outcome: docUrl,
          });
          await base44.asServiceRole.entities.MeetingNote.update(note.id, { interaction_id: interaction.id });
        } catch (e) {
          console.warn(`Interaction creation failed for doc ${docId}:`, e.message);
        }
      }

      return { status: 'processed' };
    };

    // ── Drive-fallback matching: match on the embedded session timestamp,
    // not the session name. Gemini stamps when the first participant joins,
    // which runs a little early, so allow ±30 minutes around the event start. ──
    const matchDriveDocs = (evt) => {
      const eventStart = new Date(evt.start_date);
      if (isNaN(eventStart.getTime())) return { docs: [], ambiguous: false };
      const windowMs = 30 * 60 * 1000; // ±30 minutes
      const inWindow = [];
      for (const f of driveIndex) {
        const ts = parseSessionStart(f.name);
        const ref = ts || (f.createdTime ? new Date(f.createdTime) : null);
        if (!ref || isNaN(ref.getTime())) continue;
        if (Math.abs(ref.getTime() - eventStart.getTime()) <= windowMs) inWindow.push(f);
      }
      if (inWindow.length === 0) return { docs: [], ambiguous: false };
      if (inWindow.length === 1) return { docs: [inWindow[0]], ambiguous: false };
      // >1 in the window — use title word overlap as a tiebreaker (never required).
      let best = -1, winners = [];
      for (const f of inWindow) {
        const ov = titleOverlap(evt.title, sessionName(f.name));
        if (ov > best) { best = ov; winners = [f]; }
        else if (ov === best) winners.push(f);
      }
      if (winners.length === 1) return { docs: [winners[0]], ambiguous: false };
      return { docs: [], ambiguous: true }; // genuinely ambiguous — capture nothing
    };

    let processed = 0;
    let inaccessible = 0;
    let skippedNoAttachment = 0;       // no calendar attachment AND no Drive match
    let skippedAlreadyCaptured = 0;
    let matchedViaDrive = 0;
    let driveAmbiguous = 0;
    const inaccessibleDocs = [];
    const driveCaptures = []; // { eventTitle, docName, docCreatedTime }

    for (const evt of candidates) {
      try {
        // Fetch the Google Calendar event to get attachments
        const calId = encodeURIComponent(evt.source_calendar);
        const eventId = encodeURIComponent(evt.google_event_id);
        const calRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
          { headers: { Authorization: `Bearer ${calendarToken}` } }
        );

        if (!calRes.ok) {
          console.warn(`Calendar API ${calRes.status} for event ${evt.id}`);
          continue;
        }

        const gEvent = await calRes.json();
        const attachments = gEvent.attachments || [];
        const notesAttachments = attachments.filter(a => isNotesDoc(a.title));
        const organizerEmail = gEvent.organizer?.email || '';

        if (notesAttachments.length === 0) {
          // ── Drive fallback: no calendar attachment, try the Drive index ──
          const { docs: matches, ambiguous } = matchDriveDocs(evt);
          if (matches.length === 0) {
            if (ambiguous) driveAmbiguous++;
            else skippedNoAttachment++;
          } else {
            const doc = matches[0];
            const docUrl = doc.webViewLink || `https://drive.google.com/file/d/${doc.id}/view`;
            const r = await captureFromDoc({
              evt, docId: doc.id, docTitle: doc.name, docUrl,
              organizerEmail, captureSource: 'drive_search',
            });
            if (r.status === 'processed') {
              matchedViaDrive++;
              driveCaptures.push({
                eventTitle: evt.title || '',
                docName: doc.name,
                docCreatedTime: doc.createdTime,
              });
            } else if (r.status === 'already_captured') {
              skippedAlreadyCaptured++;
            } else if (r.status === 'inaccessible') {
              inaccessible++;
              inaccessibleDocs.push(r.inaccessibleDoc);
            }
          }
          continue;
        }

        // ── Primary path: calendar attachments ──
        for (const att of notesAttachments) {
          const docId = att.fileId;
          if (!docId) continue;
          const docUrl = att.fileUrl || `https://drive.google.com/file/d/${docId}/view`;
          const r = await captureFromDoc({
            evt, docId, docTitle: att.title || '', docUrl,
            organizerEmail, captureSource: 'calendar_attachment',
          });
          if (r.status === 'already_captured') skippedAlreadyCaptured++;
          else if (r.status === 'inaccessible') { inaccessible++; inaccessibleDocs.push(r.inaccessibleDoc); }
          else if (r.status === 'processed') processed++;
        }
      } catch (e) {
        console.warn(`Error processing event ${evt.id}:`, e.message);
      }
    }

    return Response.json({
      status: 'ok',
      mode: backfillDays ? `backfill_${backfillDays}d` : 'scheduled',
      eventsScanned: events.length,
      candidates: candidates.length,
      driveIndexSize: driveIndex.length,
      driveIndexParseable,
      driveIndexInAnyWindow,
      processed,
      inaccessible,
      skipped: skippedNoAttachment + skippedAlreadyCaptured,
      skipped_no_attachment: skippedNoAttachment,
      skipped_already_captured: skippedAlreadyCaptured,
      matched_via_drive: matchedViaDrive,
      drive_ambiguous: driveAmbiguous,
      driveCaptures,
      inaccessibleDocs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});