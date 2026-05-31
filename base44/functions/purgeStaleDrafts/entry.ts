import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { record_id, record_type } = await req.json();
    if (!record_id || !record_type) {
      return Response.json({ error: 'record_id and record_type are required' }, { status: 400 });
    }

    // Fetch draft EmailLog records for this contact
    const filter = record_type === 'client'
      ? { matched_client_id: record_id, is_draft: true }
      : { matched_lead_id: record_id, is_draft: true };

    const draftLogs = await base44.asServiceRole.entities.EmailLog.filter(filter);
    if (draftLogs.length === 0) {
      return Response.json({ purged: 0 });
    }

    // Fetch all current drafts from Gmail to get the live set of draft IDs
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=500',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const gmailData = await gmailRes.json();
    const liveDraftIds = new Set((gmailData.drafts || []).map(d => d.id));

    // Delete EmailLog records whose draft no longer exists in Gmail
    let purged = 0;
    for (const log of draftLogs) {
      if (!liveDraftIds.has(log.gmail_message_id)) {
        await base44.asServiceRole.entities.EmailLog.delete(log.id);
        purged++;
      }
    }

    console.log(`Purged ${purged} stale draft(s) for ${record_type} ${record_id}`);
    return Response.json({ purged });

  } catch (error) {
    console.error('purgeStaleDrafts error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});