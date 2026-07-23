// ═══════════════════════════════════════════════════════════════════════════
// heatherOAuthHelper — TEMPORARY one-time OAuth helper for Heather's Gmail.
//
// This function is NOT internal-key protected — it's meant to be opened in
// a browser. After the refresh token is obtained and saved as
// HEATHER_GMAIL_REFRESH_TOKEN, this function should be deleted (Part 3).
//
// Flow:
//   1. Visit the function URL (no params) → shows the redirect URI + instructions
//   2. Add the redirect URI to Google Cloud Console → Authorized redirect URIs
//   3. Visit ?action=start → 302 to Google consent (login_hint=heather@skillfulmeans.life)
//   4. Google redirects back with ?code=... → exchanges code for tokens
//   5. Displays the refresh_token on screen for manual saving as a secret
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const action = url.searchParams.get('action');
  const redirectUri = `${url.origin}${url.pathname}`;

  // ── Callback from Google (code present in query) ──
  if (code) {
    const clientId = Deno.env.get('HEATHER_GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('HEATHER_GMAIL_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return htmlResponse(
        '<h1>Error</h1><p><code>HEATHER_GMAIL_CLIENT_ID</code> or <code>HEATHER_GMAIL_CLIENT_SECRET</code> secrets are not set. Set them in app settings first, then retry.</p>'
      );
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.refresh_token) {
      return htmlResponse(
        `<h1>Authorization Error</h1><p>Failed to exchange code: ${tokenData.error || 'No refresh_token returned'}</p><pre>${JSON.stringify(tokenData, null, 2)}</pre>`
      );
    }

    return htmlResponse(`
      <h1>Authorization Successful</h1>
      <p>Copy the refresh token below and save it as the <strong>HEATHER_GMAIL_REFRESH_TOKEN</strong> secret in your Base44 app settings.</p>
      <p><strong>This token will not be shown again — copy it now.</strong></p>
      <textarea readonly style="width:100%;height:120px;font-family:monospace;font-size:14px;padding:8px;">${tokenData.refresh_token}</textarea>
      <p>After saving the secret, delete the <code>heatherOAuthHelper</code> function.</p>
    `);
  }

  // ── Start OAuth flow ──
  if (action === 'start') {
    const clientId = Deno.env.get('HEATHER_GMAIL_CLIENT_ID');
    if (!clientId) {
      return htmlResponse(
        '<h1>Error</h1><p><code>HEATHER_GMAIL_CLIENT_ID</code> secret is not set. Set it in app settings first.</p>'
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
      login_hint: 'heather@skillfulmeans.life',
    });

    return Response.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      302
    );
  }

  // ── Default: show redirect URI and instructions ──
  return htmlResponse(`
    <h1>Heather Gmail OAuth Helper</h1>
    <h2>Step 1 — Add redirect URI</h2>
    <p>In your Google Cloud Console OAuth client (APIs &amp; Services → Credentials), add this exact URL to <strong>Authorized redirect URIs</strong>:</p>
    <textarea readonly style="width:100%;height:60px;font-family:monospace;font-size:14px;padding:8px;">${redirectUri}</textarea>
    <h2>Step 2 — Start authorization</h2>
    <p>Make sure you are signed in as <strong>heather@skillfulmeans.life</strong> in your browser, then click:</p>
    <p><a href="?action=start" style="font-size:18px;">Start Authorization &rarr;</a></p>
    <h2>Step 3 — Save refresh token</h2>
    <p>After authorizing, copy the refresh token and save it as <code>HEATHER_GMAIL_REFRESH_TOKEN</code> in your Base44 app settings.</p>
  `);
});

function htmlResponse(html) {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}