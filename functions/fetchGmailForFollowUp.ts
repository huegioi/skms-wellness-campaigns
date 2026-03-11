import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Fetch recent emails from Gmail - inbox + sent, last 20
    const [inboxRes, sentRes] = await Promise.all([
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=SENT', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ]);

    const inboxData = await inboxRes.json();
    const sentData = await sentRes.json();

    const allMessageIds = [
      ...(inboxData.messages || []).map(m => ({ id: m.id, direction: 'received' })),
      ...(sentData.messages || []).map(m => ({ id: m.id, direction: 'sent' }))
    ];

    // Fetch details for each message
    const messages = await Promise.all(
      allMessageIds.map(async ({ id, direction }) => {
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        const headers = data.payload?.headers || [];
        const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        return {
          id: data.id,
          threadId: data.threadId,
          direction,
          subject: get('Subject') || '(no subject)',
          from: get('From'),
          to: get('To'),
          date: get('Date'),
          snippet: data.snippet || '',
          link: `https://mail.google.com/mail/u/0/#inbox/${data.threadId || data.id}`
        };
      })
    );

    // Sort by date descending
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));

    return Response.json({ messages });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});