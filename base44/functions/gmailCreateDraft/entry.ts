import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// gmailCreateDraft — internal-only backend function that creates a Gmail
// DRAFT (never sends). Called by mayaDraftEmail and the Outreach Campaigns
// approval flow.
//
// Auth: requires MAYA_INTERNAL_KEY (same pattern as mayaContext).
// Inputs: sender ('william'|'heather'), to, cc (array), subject, body,
//         optional linkage: client_id, lead_id, referral_partner_id,
//         campaign_id, campaign_name
// Returns: { gmail_draft_id, email_log_id }
//
// William: uses the platform shared 'gmail' OAuth connector + Gmail API.
// Heather: exchanges a stored refresh token (HEATHER_GMAIL_REFRESH_TOKEN) for
//          an access token via Google's OAuth token endpoint, then uses the
//          same Gmail drafts API call. One-time setup via heatherOAuthHelper.
// ═══════════════════════════════════════════════════════════════════════════

// RFC 2047 B-encode the Subject header if it contains non-ASCII characters
function encodeSubjectHeader(subject) {
  if (/[^\x00-\x7F]/.test(subject)) {
    const bytes = new TextEncoder().encode(subject);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    const b64 = btoa(binary);
    return `=?UTF-8?B?${b64}?=`;
  }
  return subject;
}

// Base64url-encode a Uint8Array (chunked to avoid stack overflow on large bodies)
function base64UrlEncode(bytes) {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ── Internal-only auth: require MAYA_INTERNAL_KEY ──
    const INTERNAL_KEY = Deno.env.get('MAYA_INTERNAL_KEY');
    if (!INTERNAL_KEY || !body.internal_key || body.internal_key !== INTERNAL_KEY) {
      return Response.json({ error: 'Unauthorized — internal key required' }, { status: 401 });
    }

    const {
      sender,
      to,
      cc,
      subject,
      body: emailBody,
      client_id,
      lead_id,
      referral_partner_id,
      campaign_id,
      campaign_name,
    } = body;

    if (!sender || !to || subject == null || emailBody == null) {
      return Response.json(
        { error: 'Missing required fields: sender, to, subject, body' },
        { status: 400 }
      );
    }

    const isHeather = sender === 'heather';
    const fromEmail = isHeather ? 'heather@skillfulmeans.life' : 'william@skillfulmeans.life';

    // ── Obtain Gmail access token by sender ──
    let accessToken;
    if (isHeather) {
      // Heather: exchange stored refresh token for an access token
      const clientId = Deno.env.get('HEATHER_GMAIL_CLIENT_ID');
      const clientSecret = Deno.env.get('HEATHER_GMAIL_CLIENT_SECRET');
      const refreshToken = Deno.env.get('HEATHER_GMAIL_REFRESH_TOKEN');
      if (!clientId || !clientSecret || !refreshToken) {
        return Response.json(
          { error: "Heather's Gmail is not connected — re-run the authorization." },
          { status: 400 }
        );
      }
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('[gmailCreateDraft] Heather token exchange error:', tokenRes.status, errText);
        return Response.json(
          { error: "Heather's Gmail is not connected — re-run the authorization." },
          { status: 400 }
        );
      }
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
    } else {
      // William: use the platform shared Gmail connector
      try {
        const conn = await base44.asServiceRole.connectors.getConnection('gmail');
        accessToken = conn.accessToken;
      } catch (e) {
        console.error('[gmailCreateDraft] Connector error:', e.message);
        return Response.json(
          { error: "William's Gmail is not connected — authorize it in Settings" },
          { status: 400 }
        );
      }
      if (!accessToken) {
        return Response.json(
          { error: "William's Gmail is not connected — authorize it in Settings" },
          { status: 400 }
        );
      }
    }

    // ── Build MIME message ──
    const ccArray = Array.isArray(cc) ? cc.filter(Boolean) : [];

    const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${to}`,
    ];
    if (ccArray.length > 0) {
      mimeLines.push(`Cc: ${ccArray.join(', ')}`);
    }
    mimeLines.push(
      `Subject: ${encodeSubjectHeader(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      emailBody,
    );
    const rawMime = mimeLines.join('\r\n');

    const mimeBytes = new TextEncoder().encode(rawMime);
    const raw = base64UrlEncode(mimeBytes);

    // ── Create Gmail DRAFT (never send) ──
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw } }),
    });

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      console.error('[gmailCreateDraft] Gmail API error:', gmailRes.status, errText);
      return Response.json(
        { error: `Gmail API error ${gmailRes.status}: ${errText}` },
        { status: 500 }
      );
    }

    const gmailDraft = await gmailRes.json();
    const gmailDraftId = gmailDraft.id;

    // ── Mirror to EmailLog (same pattern as mayaDraftEmail) ──
    const emailLogData = {
      is_draft: true,
      gmail_message_id: gmailDraftId,
      from_email: fromEmail,
      to_email: to,
      subject: subject,
      body_preview: (emailBody || '').slice(0, 500),
      snippet: (emailBody || '').slice(0, 200),
      date: new Date().toISOString(),
      direction: 'outbound',
      gmail_account: isHeather ? 'heather' : 'william',
    };
    if (ccArray.length > 0) {
      emailLogData.cc_emails = ccArray.join(', ');
    }
    if (client_id) emailLogData.matched_client_id = client_id;
    if (lead_id) emailLogData.matched_lead_id = lead_id;

    const emailLogRecord = await base44.asServiceRole.entities.EmailLog.create(emailLogData);

    return Response.json({
      gmail_draft_id: gmailDraftId,
      email_log_id: emailLogRecord.id,
    });

  } catch (error) {
    console.error('[gmailCreateDraft] Unhandled error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});