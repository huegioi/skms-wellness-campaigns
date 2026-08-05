import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// TEMPORARY diagnostic — reports what the shared Gmail connector token can and
// cannot do (profile / drafts.get / messages.list), with raw HTTP statuses.
// Admin-only. Delete after the campaign sync issue is resolved.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const testEmail = body.test_email || 'wendy@vanguard901.com';
    const testDraftId = body.test_draft_id || 'r6303312763738032790';
    const afterTs = body.after_ts || 1785000000;

    const conn = await base44.asServiceRole.connectors.getConnection('gmail');
    const token = conn.accessToken;
    const H = { 'Authorization': `Bearer ${token}` };
    const probe = async (label, url) => {
      try {
        const r = await fetch(url, { headers: H });
        let detail = null;
        try { const j = await r.json(); detail = j.error?.message || (Array.isArray(j.messages) ? `${j.messages.length} messages` : j.emailAddress || Object.keys(j).join(',')); } catch {}
        return { label, status: r.status, detail };
      } catch (e) {
        return { label, status: 'EXC', detail: e.message };
      }
    };

    const results = [];
    results.push(await probe('profile', 'https://gmail.googleapis.com/gmail/v1/users/me/profile'));
    results.push(await probe('drafts.get', `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${testDraftId}`));
    results.push(await probe('messages.list sent-search', `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`to:${testEmail} after:${afterTs} in:sent`)}&maxResults=3`));
    results.push(await probe('messages.list plain', 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1'));

    return Response.json({ success: true, results, scopes_hint: conn.scope || conn.scopes || 'not exposed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
