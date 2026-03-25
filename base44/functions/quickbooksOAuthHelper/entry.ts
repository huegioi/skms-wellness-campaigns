import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, realmId, redirectUri } = await req.json();

    if (!code || !realmId || !redirectUri) {
      return Response.json({ 
        error: 'Missing required parameters: code, realmId, redirectUri' 
      }, { status: 400 });
    }

    // Get QuickBooks credentials from environment
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return Response.json({ 
        error: 'QuickBooks credentials not configured in environment' 
      }, { status: 500 });
    }

    // Exchange authorization code for tokens
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return Response.json({ 
        error: `Token exchange failed: ${errorText}` 
      }, { status: tokenResponse.status });
    }

    const tokens = await tokenResponse.json();

    // Auto-save tokens to secrets
    const appId = Deno.env.get('BASE44_APP_ID');
    const apiKey = Deno.env.get('BASE44_API_KEY');
    if (appId && apiKey) {
      const saveSecrets = async (name, value) => {
        await fetch(`https://api.base44.com/api/apps/${appId}/secrets`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ name, value })
        });
      };
      await saveSecrets('QUICKBOOKS_REFRSH_TOKEN', tokens.refresh_token);
      await saveSecrets('Quickbooks_ACCESS_TOKEN', tokens.access_token);
      await saveSecrets('QUICKBOOK_REALM_ID', realmId);
      console.log('QuickBooks tokens auto-saved to secrets.');
    }

    return Response.json({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      realm_id: realmId,
      expires_in: tokens.expires_in,
      auto_saved: !!(appId && apiKey)
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});