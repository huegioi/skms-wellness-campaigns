import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clientEmail } = await req.json();
    if (!clientEmail) return Response.json({ error: 'clientEmail is required' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Search for emails to/from client (last 20)
    const query = encodeURIComponent(`from:${clientEmail} OR to:${clientEmail}`);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ emails: [], lastContactDate: null });
    }

    // Fetch metadata for each message in parallel
    const emailDetails = await Promise.all(
      listData.messages.map(async (msg) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject,From,To,Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();

        const headers = msgData.payload?.headers || [];
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const from = getHeader('From');
        const to = getHeader('To');
        const subject = getHeader('Subject');
        const isFromClient = from.toLowerCase().includes(clientEmail.toLowerCase());

        // internalDate is a Unix timestamp in milliseconds - much more reliable than parsing Date header
        const internalDate = msgData.internalDate ? new Date(parseInt(msgData.internalDate)).toISOString() : null;

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject: subject || '(No Subject)',
          from,
          to,
          date: internalDate,
          snippet: msgData.snippet || '',
          direction: isFromClient ? 'received' : 'sent'
        };
      })
    );

    // Sort newest first
    emailDetails.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    const lastContactDate = emailDetails[0]?.date || null;

    return Response.json({ emails: emailDetails, lastContactDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});