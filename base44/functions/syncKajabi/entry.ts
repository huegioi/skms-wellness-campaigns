import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const CORPORATE_LEADS_TAG = 'corporate leads';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Exponential backoff retry helper
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited, wait and retry
      if (response.status === 429) {
        if (attempt < retries) {
          const waitTime = RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (attempt < retries) {
        const waitTime = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`Request failed: ${error.message}. Retrying in ${waitTime}ms (${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}

async function getAccessToken() {
  const clientId = Deno.env.get('KAJABI_CLIENT_ID');
  const clientSecret = Deno.env.get('KAJABI_CLIENT_SECRET');

  const response = await fetchWithRetry('https://api.kajabi.com/v1/oauth/token', {
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

// Validate contact data against schema
function validateContactData(data) {
  if (!data.email || typeof data.email !== 'string') {
    throw new Error('Invalid contact: email is required and must be a string');
  }
  if (!data.kajabi_id || typeof data.kajabi_id !== 'string') {
    throw new Error('Invalid contact: kajabi_id is required and must be a string');
  }
  if (data.subscribed !== undefined && typeof data.subscribed !== 'boolean') {
    throw new Error('Invalid contact: subscribed must be a boolean');
  }
  if (data.tags && !Array.isArray(data.tags)) {
    throw new Error('Invalid contact: tags must be an array');
  }
  return true;
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
  const response = await fetchWithRetry(
    `${KAJABI_API_URL}/contacts/${contactId}/tags`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    console.warn(`Failed to fetch tags for contact ${contactId}: ${response.status}`);
    return [];
  }

  const result = await response.json();
  return (result.data || []).map(tag => tag.attributes?.name).filter(Boolean);
}

// Check if contact has corporate leads tag
function hasCorporateLeadsTag(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some(tag => 
    tag.toLowerCase().trim() === CORPORATE_LEADS_TAG.toLowerCase()
  );
}


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !isTeamMember(user)) {
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
      const maxPagesPerRun = 10;
      let errorDetails = progress.error_details || [];

      while (progress.next_url && pagesThisRun < maxPagesPerRun) {
        if (pagesThisRun > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log(`Fetching page ${progress.page_count + 1} from: ${progress.next_url}`);

        try {
          const response = await fetchWithRetry(progress.next_url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            const errorMsg = `API Error: ${response.status} - ${errorText}`;
            console.error(errorMsg);
            
            errorDetails.push({
              page: progress.page_count + 1,
              error: errorMsg,
              timestamp: new Date().toISOString()
            });
            
            progress.error_count = (progress.error_count || 0) + 1;
            progress.retry_count = (progress.retry_count || 0) + MAX_RETRIES;
            
            await base44.asServiceRole.entities.KajabiSyncProgress.update(progress.id, {
              status: 'failed',
              error_message: errorMsg,
              error_details: errorDetails,
              error_count: progress.error_count,
              retry_count: progress.retry_count,
              completed_at: new Date().toISOString()
            });
            return Response.json({ success: false, error: errorMsg }, { status: 500 });
          }

          const result = await response.json();
          const contacts = result.data || [];

          console.log(`Page ${progress.page_count + 1}: Received ${contacts.length} contacts`);

          const toCreate = [];
          const toUpdate = [];
          let skippedThisPage = 0;

          for (let i = 0; i < contacts.length; i++) {
            const kajabiContact = contacts[i];
            try {
              const attrs = kajabiContact.attributes;
              const kajabiId = kajabiContact.id;

              // Add delay between tag fetches to avoid rate limiting (500ms)
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              // Fetch tags for this contact
              const tags = await fetchContactTags(accessToken, kajabiId);
              
              // Filter: Only process contacts with "corporate leads" tag
              if (!hasCorporateLeadsTag(tags)) {
                skippedThisPage++;
                continue;
              }

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

              // Validate data
              validateContactData(contactData);

              const existingContact = localContactMap.get(kajabiId);

              if (existingContact) {
                // Idempotency: Only update if data actually changed
                const hasChanges = 
                  existingContact.name !== contactData.name ||
                  existingContact.email !== contactData.email ||
                  existingContact.subscribed !== contactData.subscribed ||
                  existingContact.phone_number !== contactData.phone_number ||
                  JSON.stringify(existingContact.tags || []) !== JSON.stringify(contactData.tags);

                if (hasChanges) {
                  toUpdate.push({ id: existingContact.id, data: contactData });
                }
              } else {
                toCreate.push(contactData);
                localContactMap.set(kajabiId, contactData);
              }
            } catch (validationError) {
              console.warn(`Skipping invalid contact ${kajabiContact.id}: ${validationError.message}`);
              skippedThisPage++;
            }
          }

          // Create new contacts
          if (toCreate.length > 0) {
            await base44.asServiceRole.entities.KajabiContact.bulkCreate(toCreate);
            progress.new_count += toCreate.length;
          }

          // Batch update
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
          progress.skipped_count = (progress.skipped_count || 0) + skippedThisPage;
          progress.page_count++;
          progress.last_successful_page = progress.page_count;
          pagesThisRun++;

          console.log(`Page ${progress.page_count}: ${toCreate.length} new, ${toUpdate.length} updated, ${skippedThisPage} skipped (no corporate leads tag)`);

          const nextUrl = result.links?.next || null;
          await base44.asServiceRole.entities.KajabiSyncProgress.update(progress.id, {
            next_url: nextUrl,
            page_count: progress.page_count,
            total_processed: progress.total_processed,
            new_count: progress.new_count,
            updated_count: progress.updated_count,
            skipped_count: progress.skipped_count,
            last_successful_page: progress.last_successful_page,
            error_details: errorDetails
          });

          progress.next_url = nextUrl;

          if (!nextUrl) {
            console.log('Sync complete!');
            await base44.asServiceRole.entities.KajabiSyncProgress.update(progress.id, {
              status: 'completed',
              completed_at: new Date().toISOString()
            });
            break;
          }
        } catch (pageError) {
          console.error(`Error processing page ${progress.page_count + 1}:`, pageError);
          
          errorDetails.push({
            page: progress.page_count + 1,
            error: pageError.message,
            timestamp: new Date().toISOString()
          });
          
          progress.error_count = (progress.error_count || 0) + 1;
          
          await base44.asServiceRole.entities.KajabiSyncProgress.update(progress.id, {
            error_details: errorDetails,
            error_count: progress.error_count
          });
          
          // Continue to next page instead of failing completely
          progress.page_count++;
          const tempResult = { links: { next: progress.next_url } };
          progress.next_url = tempResult.links?.next || null;
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
          skipped: progress.skipped_count || 0,
          errors: progress.error_count || 0,
          retries: progress.retry_count || 0,
          totalInDatabase: finalContacts.length,
          subscribedInDatabase: finalContacts.filter(c => c.subscribed).length,
          unsubscribedInDatabase: finalContacts.filter(c => !c.subscribed).length
        },
        message: isComplete 
          ? `✅ Sync complete! Processed ${progress.total_processed} contacts (${progress.new_count} new, ${progress.updated_count} updated, ${progress.skipped_count || 0} skipped without "corporate leads" tag). Database: ${finalContacts.length} contacts.`
          : `📊 Processed ${pagesThisRun} pages (${progress.page_count} total, ${progress.total_processed} contacts, ${progress.skipped_count || 0} skipped). More pages remaining.`
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