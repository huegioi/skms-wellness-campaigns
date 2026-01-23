import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';

async function getAccessToken() {
  const clientId = Deno.env.get('KAJABI_CLIENT_ID');
  const clientSecret = Deno.env.get('KAJABI_CLIENT_SECRET');

  const response = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchAllContacts(accessToken) {
  const siteId = Deno.env.get('KAJABI_SITE_ID');
  let allContacts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&page[number]=${page}&page[size]=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch contacts: ${errorText}`);
    }

    const result = await response.json();
    allContacts = allContacts.concat(result.data || []);

    // Check if there are more pages
    hasMore = result.meta?.has_more || false;
    page++;
  }

  return allContacts;
}

async function fetchContactTags(accessToken, contactId) {
  const response = await fetch(
    `${KAJABI_API_URL}/contacts/${contactId}/tags`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    return [];
  }

  const result = await response.json();
  return (result.data || []).map(tag => tag.attributes?.name).filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action } = await req.json().catch(() => ({ action: 'syncAll' }));

    if (action === 'syncAll') {
      const accessToken = await getAccessToken();
      const kajabiContacts = await fetchAllContacts(accessToken);
      
      const localContacts = await base44.asServiceRole.entities.KajabiContact.filter({});
      const localContactMap = new Map(localContacts.map(c => [c.kajabi_id, c]));

      const results = {
        new: 0,
        updated: 0,
        unsubscribed: 0,
        total: kajabiContacts.length
      };

      for (const kajabiContact of kajabiContacts) {
        const attrs = kajabiContact.attributes;
        const kajabiId = kajabiContact.id;

        // Fetch tags for this contact (batch this in production for better performance)
        const tags = await fetchContactTags(accessToken, kajabiId);

        const contactData = {
          kajabi_id: kajabiId,
          name: attrs.name || '',
          email: attrs.email,
          subscribed: attrs.subscribed || false,
          phone_number: attrs.phone_number || '',
          tags: tags,
          kajabi_created_at: attrs.created_at,
          last_synced: new Date().toISOString()
        };

        const existingContact = localContactMap.get(kajabiId);

        if (existingContact) {
          // Track if they unsubscribed
          if (existingContact.subscribed && !contactData.subscribed) {
            results.unsubscribed++;
          }
          
          await base44.asServiceRole.entities.KajabiContact.update(
            existingContact.id,
            contactData
          );
          results.updated++;
        } else {
          await base44.asServiceRole.entities.KajabiContact.create(contactData);
          results.new++;
        }
      }

      return Response.json({
        success: true,
        results,
        message: `Synced ${results.total} contacts: ${results.new} new, ${results.updated} updated, ${results.unsubscribed} unsubscribed`
      });
    }

    if (action === 'getStats') {
      const contacts = await base44.asServiceRole.entities.KajabiContact.filter({});
      const events = await base44.asServiceRole.entities.KajabiEvent.filter({});
      
      const subscribed = contacts.filter(c => c.subscribed).length;
      const unsubscribed = contacts.filter(c => !c.subscribed).length;
      
      // Calculate growth over last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const newLast30Days = contacts.filter(c => 
        c.kajabi_created_at && new Date(c.kajabi_created_at) > thirtyDaysAgo
      ).length;

      // Tag distribution
      const tagCounts = {};
      contacts.forEach(c => {
        (c.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // Event-based engagement metrics (last 30 days)
      const recentEvents = events.filter(e => 
        e.event_date && new Date(e.event_date) > thirtyDaysAgo
      );

      const eventTypeCounts = {};
      recentEvents.forEach(e => {
        const type = e.event_type || 'unknown';
        eventTypeCounts[type] = (eventTypeCounts[type] || 0) + 1;
      });

      const topEvents = Object.entries(eventTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // Form submissions
      const formSubmissions = recentEvents.filter(e => 
        e.event_type?.includes('form')
      ).length;

      // Tag engagements
      const tagEngagements = recentEvents.filter(e => 
        e.event_type?.includes('tag')
      ).length;

      // Purchases/conversions
      const conversions = recentEvents.filter(e => 
        e.event_type?.includes('purchase') || e.event_type?.includes('subscription')
      ).length;

      return Response.json({
        success: true,
        stats: {
          total: contacts.length,
          subscribed,
          unsubscribed,
          newLast30Days,
          topTags,
          engagement: {
            totalEvents: recentEvents.length,
            formSubmissions,
            tagEngagements,
            conversions,
            topEvents
          }
        }
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Kajabi sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});