import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const QB_API_URL = 'https://quickbooks.api.intuit.com/v3/company';

async function getStoredRefreshToken(client) {
  try {
    const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'refresh_token' });
    if (configs && configs.length > 0) return configs[0].value;
  } catch (e) {
    console.log('Could not read refresh token from DB:', e.message);
  }
  return Deno.env.get('QUICKBOOKS_REFRESH_TOKEN');
}

async function saveRefreshToken(client, newToken) {
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

async function getRealmId(client) {
  try {
    const configs = await client.asServiceRole.entities.QuickBooksConfig.filter({ key: 'realm_id' });
    if (configs && configs.length > 0) return configs[0].value;
  } catch (e) {}
  return Deno.env.get('QUICKBOOK_REALM_ID');
}

async function getAccessToken(client) {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  const refreshToken = await getStoredRefreshToken(client);

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json();
  if (data.refresh_token) await saveRefreshToken(client, data.refresh_token);
  return data.access_token;
}

async function qbRequest(accessToken, realmId, method, path, body) {
  const url = `${QB_API_URL}/${realmId}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  };
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.Fault?.Error?.[0]?.Detail || parsed.Fault?.Error?.[0]?.Message || text;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const realmId = await getRealmId(base44);
    if (!realmId) {
      return Response.json({ error: 'QuickBooks not configured' }, { status: 500 });
    }

    const accessToken = await getAccessToken(base44);

    // Fetch all local services and all QB service-type items in parallel
    const [services, qbQueryResult] = await Promise.all([
      base44.asServiceRole.entities.Service.filter({}),
      qbRequest(accessToken, realmId, 'GET',
        `/query?query=${encodeURIComponent("SELECT * FROM Item WHERE Type = 'Service' MAXRESULTS 1000")}`,
        null
      )
    ]);

    const qbItems = qbQueryResult.QueryResponse?.Item || [];

    // Build lookup maps for quick matching
    const qbByName = {};
    const qbById = {};
    for (const item of qbItems) {
      qbByName[item.Name.toLowerCase()] = item;
      qbById[item.Id] = item;
    }

    const results = [];

    for (const service of services) {
      try {
        // Find match by stored QB id first, then fall back to name
        let existingItem = null;
        if (service.quickbooks_item_id && qbById[service.quickbooks_item_id]) {
          existingItem = qbById[service.quickbooks_item_id];
        } else if (qbByName[service.name.toLowerCase()]) {
          existingItem = qbByName[service.name.toLowerCase()];
        }

        let qbItemId;
        let action;

        if (existingItem) {
          // Update existing QB item
          const result = await qbRequest(accessToken, realmId, 'POST', '/item', {
            Id: existingItem.Id,
            SyncToken: existingItem.SyncToken,
            Name: existingItem.Name, // preserve original name to avoid conflicts
            Type: 'Service',
            UnitPrice: service.price ?? 0,
            Description: service.description || service.short_description || ''
          });
          qbItemId = result.Item.Id;
          action = 'updated';
        } else {
          // Create new QB item
          const result = await qbRequest(accessToken, realmId, 'POST', '/item', {
            Name: service.name,
            Type: 'Service',
            UnitPrice: service.price ?? 0,
            Description: service.description || service.short_description || ''
          });
          qbItemId = result.Item.Id;
          action = 'created';
          // Add to maps so subsequent services don't create a duplicate
          qbById[qbItemId] = result.Item;
          qbByName[service.name.toLowerCase()] = result.Item;
        }

        // Save QB item ID back to the service entity if not already set or changed
        if (service.quickbooks_item_id !== qbItemId) {
          await base44.asServiceRole.entities.Service.update(service.id, {
            quickbooks_item_id: qbItemId
          });
        }

        results.push({ id: service.id, name: service.name, qb_item_id: qbItemId, action });
      } catch (error) {
        console.error(`Failed to sync service "${service.name}":`, error.message);
        results.push({ id: service.id, name: service.name, action: 'failed', error: error.message });
      }
    }

    return Response.json({
      success: true,
      results,
      total: results.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      failed: results.filter(r => r.action === 'failed').length
    });

  } catch (error) {
    console.error('syncServicesToQB error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});