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
  let nextUrl = `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&page[size]=100`;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    console.log(`Fetching page ${pageCount}: ${nextUrl}`);
    
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch contacts: ${errorText}`);
    }

    const result = await response.json();
    const contacts = result.data || [];
    allContacts = allContacts.concat(contacts);

    console.log(`Page ${pageCount}: Fetched ${contacts.length} contacts (total so far: ${allContacts.length})`);
    console.log(`Next URL from API: ${result.links?.next || 'NONE'}`);

    // Check for next page URL in links
    nextUrl = result.links?.next || null;
    
    if (!nextUrl) {
      console.log('No more pages - pagination complete');
    }
    
    // Safety limit to prevent infinite loops
    if (allContacts.length > 50000) {
      console.log('Safety limit reached at 50k contacts');
      break;
    }
  }

  console.log(`Total contacts fetched from Kajabi: ${allContacts.length} across ${pageCount} pages`);
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
      
      // Fetch ALL local contacts (no limit)
      const localContacts = await base44.asServiceRole.entities.KajabiContact.list('', 100000);
      const localContactMap = new Map(localContacts.map(c => [c.kajabi_id, c]));

      const results = {
        new: 0,
        updated: 0,
        unsubscribed: 0,
        total: kajabiContacts.length
      };

      // Process in batches for better performance
      const toCreate = [];
      const toUpdate = [];

      for (const kajabiContact of kajabiContacts) {
        const attrs = kajabiContact.attributes;
        const kajabiId = kajabiContact.id;

        const contactData = {
          kajabi_id: kajabiId,
          name: attrs.name || '',
          email: attrs.email,
          subscribed: attrs.subscribed || false,
          phone_number: attrs.phone_number || '',
          tags: [],
          kajabi_created_at: attrs.created_at,
          last_synced: new Date().toISOString()
        };

        const existingContact = localContactMap.get(kajabiId);

        if (existingContact) {
          if (existingContact.subscribed && !contactData.subscribed) {
            results.unsubscribed++;
          }
          toUpdate.push({ id: existingContact.id, data: contactData });
        } else {
          toCreate.push(contactData);
        }
      }

      console.log(`Processing ${kajabiContacts.length} total contacts from Kajabi`);
      console.log(`Found ${toCreate.length} new contacts to create`);
      console.log(`Found ${toUpdate.length} existing contacts to update`);

      // Batch create new contacts (chunks of 100)
      if (toCreate.length > 0) {
        console.log(`Creating ${toCreate.length} new contacts in batches...`);
        for (let i = 0; i < toCreate.length; i += 100) {
          const batch = toCreate.slice(i, i + 100);
          await base44.asServiceRole.entities.KajabiContact.bulkCreate(batch);
          results.new += batch.length;
          console.log(`Created batch ${Math.floor(i / 100) + 1}/${Math.ceil(toCreate.length / 100)} (${results.new} total)`);
        }
      }

      // Update existing contacts in batches (chunks of 50 for safety)
      if (toUpdate.length > 0) {
        console.log(`Updating ${toUpdate.length} existing contacts...`);
        for (let i = 0; i < toUpdate.length; i++) {
          const { id, data } = toUpdate[i];
          await base44.asServiceRole.entities.KajabiContact.update(id, data);
          results.updated++;
          if ((i + 1) % 100 === 0 || i === toUpdate.length - 1) {
            console.log(`Updated ${results.updated}/${toUpdate.length} contacts`);
          }
        }
      }

      // Get updated stats after sync
      const finalContacts = await base44.asServiceRole.entities.KajabiContact.list('', 100000);
      const finalSubscribed = finalContacts.filter(c => c.subscribed).length;
      const finalUnsubscribed = finalContacts.filter(c => !c.subscribed).length;

      return Response.json({
        success: true,
        results: {
          ...results,
          totalInDatabase: finalContacts.length,
          subscribedInDatabase: finalSubscribed,
          unsubscribedInDatabase: finalUnsubscribed
        },
        message: `Synced ${results.total} contacts from Kajabi: ${results.new} new, ${results.updated} updated, ${results.unsubscribed} unsubscribed. Database now has ${finalContacts.length} total contacts.`
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