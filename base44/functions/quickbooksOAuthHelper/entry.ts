import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { code, realmId, redirectUri } = await req.json();

    if (!code || !realmId || !redirectUri) {
      return Response.json({ 
        error: 'Missing required parameters: code, realmId, redirectUri' 
      }, { status: 400 });
    }

    // Get QuickBooks credentials from environment
    const clientId = 'AB5KPT41UQ5y4EmarYTVEVhAXCkj3blxtvpXDbpdymHaGMkY6i';
    const clientSecret = 'TcNEgM9UZqiR1ZllrvT3k8I4xH8JnqL1oP6bAZQO';
    console.log('Client ID starts with:', clientId?.substring(0, 10), 'Secret starts with:', clientSecret?.substring(0, 10));

    if (!clientId || !clientSecret) {
      return Response.json({ 
        error: 'QuickBooks credentials not configured in environment' 
      }, { status: 500 });
    }

    // Exchange authorization code for tokens
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const credentials = btoa(`${clientId}:${clientSecret}`);

    console.log('Exchanging code, redirect URI:', redirectUri);
    console.log('Code first 10:', code?.substring(0, 10));

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

    // Save refresh token and realm ID to QuickBooksConfig entity
    const saveConfig = async (key, value) => {
      const existing = await base44.asServiceRole.entities.QuickBooksConfig.filter({ key });
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.QuickBooksConfig.update(existing[0].id, { value, updated_at: new Date().toISOString() });
      } else {
        await base44.asServiceRole.entities.QuickBooksConfig.create({ key, value, updated_at: new Date().toISOString() });
      }
    };

    await saveConfig('refresh_token', tokens.refresh_token);
    console.log('Saving realm ID:', realmId);
    await saveConfig('realm_id', realmId);
    console.log('QuickBooks tokens saved to QuickBooksConfig entity.');

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