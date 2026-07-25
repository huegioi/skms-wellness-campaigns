// Shared QuickBooks token resolution — mirrors the logic in quickbooksSync.
// quickbooksSync/entry.ts is frozen and can't be refactored to import from here,
// but new functions should import from this module instead of duplicating.

const QB_API_URL = 'https://quickbooks.api.intuit.com/v3/company';

export async function getStoredRefreshToken(client) {
  const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'refresh_token' });
  if (configs && configs.length > 0) {
    return configs[0].value;
  }
  return null;
}

export async function saveRefreshToken(client, newToken) {
  const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'refresh_token' });
  if (configs && configs.length > 0) {
    await client.asServiceRole.entities.QuickBooksConfig.update(configs[0].id, {
      value: newToken,
      updated_at: new Date().toISOString()
    });
  } else {
    await client.asServiceRole.entities.QuickBooksConfig.create({
      key: 'refresh_token',
      value: newToken,
      updated_at: new Date().toISOString()
    });
  }
}

export async function getRealmId(client) {
  const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'realm_id' });
  if (configs && configs.length > 0) {
    return configs[0].value;
  }
  return null;
}

export async function getAccessToken(client) {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  const refreshToken = await getStoredRefreshToken(client);

  if (!refreshToken) {
    throw new Error('No refresh_token found in QuickBooksConfig DB record.');
  }
  if (!clientId || !clientSecret) {
    throw new Error('QUICKBOOKS_CLIENT_ID or QUICKBOOKS_CLIENT_SECRET env var not set.');
  }

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks token refresh failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // QuickBooks rotates refresh tokens on every use — must save the new one.
  let rotated = false;
  if (data.refresh_token) {
    await saveRefreshToken(client, data.refresh_token);
    rotated = true;
  }

  return { accessToken: data.access_token, tokenRotated: rotated };
}

export { QB_API_URL };