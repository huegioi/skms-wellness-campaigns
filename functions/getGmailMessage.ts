import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const decodeBase64Url = (encoded) => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
};

const extractBody = (payload) => {
  if (!payload) return { body: '', isHtml: false };

  // Direct body data
  if (payload.body?.data) {
    const isHtml = payload.mimeType === 'text/html';
    return { body: decodeBase64Url(payload.body.data), isHtml };
  }

  if (payload.parts) {
    // Prefer HTML part
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return { body: decodeBase64Url(htmlPart.body.data), isHtml: true };
    }
    // Fallback to plain text
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return { body: decodeBase64Url(textPart.body.data), isHtml: false };
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result.body) return result;
    }
  }

  return { body: '', isHtml: false };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messageId } = await req.json();
    if (!messageId) return Response.json({ error: 'messageId is required' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msgData = await res.json();

    const { body, isHtml } = extractBody(msgData.payload);

    return Response.json({ body, isHtml });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});