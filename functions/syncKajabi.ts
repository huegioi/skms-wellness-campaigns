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
      const siteId = Deno.env.get('KAJABI_SITE_ID');

      // Check for existing progress
      const progressRecords = await base44.asServiceRole.entities.KajabiSyncProgress.filter({ 
        sync_type: 'contacts', 
        status: 'in_progress' 
      });

      let progress;
      if (progressRecords.length > 0) {
        progress = progressRecords[0];
        console.log(`Resuming sync from page ${progress.page_count + 1}`);
      } else {
        // Create new progress record
        progress = await base44.asServiceRole.entities.KajabiSyncProgress.create({
          sync_type: 'contacts',
          next_url: `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&page[size]=100`,
          page_count: 0,
          total_processed: 0,
          new_count: 0,
          updated_count: 0,
          status: 'in_progress',
          started_at: new Date().toISOString()
        });
        console.log('Starting new sync');
      }

      // Load local contacts map once
      const localContacts = await base44.asServiceRole.entities.KajabiContact.list('', 100000);
      const localContactMap = new Map(localContacts.map(c => [c.kajabi_id, c]));
      console.log(`Loaded ${localContacts.length} existing contacts from database`);

      let pagesThisRun = 0;
      const maxPagesPerRun = 50; // Process 50 pages per invocation to avoid timeout

      while (progress.next_url && pagesThisRun < maxPagesPerRun) {
        console.log(`Fetching page ${progress.page_count + 1} from: ${progress.next_url}`);

        const response = await fetch(progress.next_url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error: ${response.status} - ${errorText}`);
          await base44.asServiceRole.entities.KajabiSyncProgress.update(progress.id, {
            status: 'failed',
            error_message: `API Error: ${response.status} - ${errorText}`,
            completed_at: new Date().toISOString()
          });
          return Response.json({ success: false, error: `API request failed: ${errorText}` }, { status: 500 });
        }

        const result = await response.json();
        const contacts = result.data || [];

        console.log(`Page ${progress.page_count + 1}: Received ${contacts.length} contacts`);
        console.log(`Next URL in response: ${result.links?.next || 'NONE'}`);

        // Process contacts
        const toCreate = [];
        const toUpdate = [];

        for (const kajabiContact of contacts) {
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
            // Only update if data changed
            const hasChanges = 
              existingContact.name !== contactData.name ||
              existingContact.email !== contactData.email ||
              existingContact.subscribed !== contactData.subscribed ||
              existingContact.phone_number !== contactData.phone_number;

            if (hasChanges) {
              toUpdate.push({ id: existingContact.id, data: contactData });
            }
          } else {
            toCreate.push(contactData);
            localContactMap.set(kajabiId, contactData);
          }
        }

        // Create new contacts
        if (toCreate.length > 0) {
          await base44.asServiceRole.entities.KajabiContact.bulkCreate(toCreate);
          progress.new_count += toCreate.length;
        }

        // Batch update (10 at a time)
        if (toUpdate.length > 0) {
          for (let i = 0; i < toUpdate.length; i += 10) {
            const batch = toUpdate.slice(i, i + 10);
            await Promise.all(
              batch.map(({ id, data }) => 
                base44.asServiceRole.entities.KajabiContact.update(id, data)
              )
            );
            progress.updated_count += batch.length;
          }
        }

        progress.total_processed += contacts.length;
        progress.page_count++;
        pagesThisRun++;

        console.log(`Processed page ${progress.page_count}: ${toCreate.length} new, ${toUpdate.length} updated (${contacts.length - toCreate.length - toUpdate.length} unchanged)`);

        // Update progress
        const nextUrl = result.links?.next || null;
        await base44.asServiceRole.entities.KajabiSyncProgress.update(progress.id, {
          next_url: nextUrl,
          page_count: progress.page_count,
          total_processed: progress.total_processed,
          new_count: progress.new_count,
          updated_count: progress.updated_count
        });

        progress.next_url = nextUrl;

        if (!nextUrl) {
          console.log('No more pages - sync complete!');
          await base44.asServiceRole.entities.KajabiSyncProgress.update(progress.id, {
            status: 'completed',
            completed_at: new Date().toISOString()
          });
          break;
        }
      }

      const finalContacts = await base44.asServiceRole.entities.KajabiContact.list('', 100000);
      const isComplete = !progress.next_url;

      return Response.json({
        success: true,
        completed: isComplete,
        results: {
          pagesProcessed: progress.page_count,
          totalProcessed: progress.total_processed,
          new: progress.new_count,
          updated: progress.updated_count,
          totalInDatabase: finalContacts.length,
          subscribedInDatabase: finalContacts.filter(c => c.subscribed).length,
          unsubscribedInDatabase: finalContacts.filter(c => !c.subscribed).length
        },
        message: isComplete 
          ? `✅ Sync complete! Processed ${progress.total_processed} contacts across ${progress.page_count} pages. Database has ${finalContacts.length} total contacts.`
          : `📊 Processed ${pagesThisRun} pages this run (${progress.page_count} total pages so far, ${progress.total_processed} contacts). More pages remaining - call sync again to continue.`
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