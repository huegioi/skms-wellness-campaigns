import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ImapFlow } from 'npm:imapflow@1.0.162';
import { simpleParser } from 'npm:mailparser@3.6.0';

const ACCOUNTS = [
  { email: 'admin@skillfulmeans.life', passwordEnv: 'GMAIL_ADMIN_PASSWORD' },
  { email: 'shrimi@skillfulmeans.life', passwordEnv: 'GMAIL_SHRIMI_PASSWORD' },
  { email: 'heather@skillfulmeans.life', passwordEnv: 'GMAIL_HEATHER_PASSWORD' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messageId } = await req.json();
    if (!messageId) return Response.json({ error: 'messageId is required' }, { status: 400 });

    // messageId format: "accountEmail:uid"
    const colonIdx = messageId.indexOf(':');
    if (colonIdx === -1) {
      // Legacy Gmail API message ID — fall back to OAuth connector
      const base44C = createClientFromRequest(req);
      const { accessToken } = await base44C.asServiceRole.connectors.getConnection('gmail');
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await res.json();
      const { body, isHtml } = extractGmailApiBody(msgData.payload);
      return Response.json({ body, isHtml });
    }

    const accountEmail = messageId.substring(0, colonIdx);
    const uid = parseInt(messageId.substring(colonIdx + 1));

    const account = ACCOUNTS.find(a => a.email === accountEmail);
    if (!account) return Response.json({ error: 'Unknown account' }, { status: 400 });

    const password = Deno.env.get(account.passwordEnv);
    if (!password) return Response.json({ error: 'Account password not configured' }, { status: 500 });

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: accountEmail, pass: password },
      logger: false,
    });

    await client.connect();
    let body = '';
    let isHtml = false;

    try {
      const lock = await client.getMailboxLock('[Gmail]/All Mail');
      try {
        const msg = await client.fetchOne(`${uid}`, { source: true }, { uid: true });
        if (msg?.source) {
          const parsed = await simpleParser(msg.source);
          if (parsed.html) {
            body = parsed.html;
            isHtml = true;
          } else {
            body = parsed.text || '';
            isHtml = false;
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return Response.json({ body, isHtml });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Fallback for legacy Gmail API message IDs
function decodeBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function extractGmailApiBody(payload) {
  if (!payload) return { body: '', isHtml: false };
  if (payload.body?.data) {
    return { body: decodeBase64Url(payload.body.data), isHtml: payload.mimeType === 'text/html' };
  }
  if (payload.parts) {
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) return { body: decodeBase64Url(htmlPart.body.data), isHtml: true };
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) return { body: decodeBase64Url(textPart.body.data), isHtml: false };
    for (const part of payload.parts) {
      const result = extractGmailApiBody(part);
      if (result.body) return result;
    }
  }
  return { body: '', isHtml: false };
}