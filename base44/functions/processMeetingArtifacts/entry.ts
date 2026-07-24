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
      return Response.json({ status: 'ok', mode: backfillDays ? `backfill_${backfillDays}d` : 'scheduled', message: 'No candidate events', processed: 0, inaccessible: 0, skipped: 0, inaccessibleDocs: [] });
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

    let processed = 0;
    let inaccessible = 0;
    let skipped = 0;
    const inaccessibleDocs = [];

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

        if (notesAttachments.length === 0) {
          skipped++;
          continue;
        }

        const organizerEmail = gEvent.organizer?.email || '';

        for (const att of notesAttachments) {
          const docId = att.fileId;
          if (!docId) continue;

          // Dedup by doc_id — skip if already captured, but re-attempt if inaccessible
          const existing = await base44.asServiceRole.entities.MeetingNote.filter({ doc_id: docId }, '-created_date', 1);
          const existingNote = existing[0];
          if (existingNote && existingNote.access_status === 'captured') {
            skipped++;
            continue;
          }

          // Try to export the doc as plain text via Google Drive
          let fullText = '';
          let accessible = false;

          try {
            // Try export endpoint (works for Google Docs)
            const exportRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
              { headers: { Authorization: `Bearer ${driveToken}` } }
            );

            if (exportRes.ok) {
              fullText = await exportRes.text();
              accessible = true;
            } else if (exportRes.status === 404) {
              // Maybe not a Google Doc — try direct media download
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

          const docUrl = att.fileUrl || `https://drive.google.com/file/d/${docId}/view`;
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
                doc_title: att.title || '',
                full_text: '',
                summary: '',
                organizer_email: organizerEmail,
                access_status: 'inaccessible',
                meeting_title: evt.title || '',
                meeting_date: evt.start_date || null,
                captured_at: capturedAt,
                is_demo: false,
              });
            }
            inaccessibleDocs.push({
              meetingTitle: evt.title || '',
              meetingDate: evt.start_date || '',
              organizerEmail,
              docTitle: att.title || '',
              docUrl,
              hint: `Doc not shared with the connected account — ask ${organizerEmail || 'the organizer'} to share their Meet Recordings folder.`,
            });
            inaccessible++;
            continue;
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
            doc_title: att.title || '',
            full_text: fullText.substring(0, 30000),
            summary,
            organizer_email: organizerEmail,
            access_status: 'captured',
            meeting_title: evt.title || '',
            meeting_date: evt.start_date || null,
            captured_at: capturedAt,
            is_demo: false,
          };

          let note;
          if (existingNote) {
            // Previously inaccessible — update in place
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

          processed++;
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
      processed,
      inaccessible,
      skipped,
      inaccessibleDocs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});