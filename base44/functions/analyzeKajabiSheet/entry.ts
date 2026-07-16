import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '1dHRcIu37VBo60y8r2huwWTZcPdaS9mmLBdtTYC-dGKo';
const SHEET_NAME = 'All contacts 02202026';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get Google Sheets access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Fetch all data from the sheet
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'No data in spreadsheet' 
      });
    }

    // Parse header row
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const dataRows = rows.slice(1);

    const getColumnIndex = (name) => headers.findIndex(h => h.includes(name));
    
    const emailIdx = getColumnIndex('email');
    const subscribedIdx = getColumnIndex('subscribed') || getColumnIndex('subscription');
    const tagsIdx = getColumnIndex('tag');
    const createdIdx = getColumnIndex('created');

    // Calculate analytics
    let total = 0;
    let subscribed = 0;
    let unsubscribed = 0;
    let newLast30Days = 0;
    const tagCounts = {};

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    dataRows.forEach(row => {
      const email = row[emailIdx]?.trim();
      if (!email || !email.includes('@')) return;

      total++;

      // Subscription status
      const isSubscribed = subscribedIdx !== -1 ? 
        (row[subscribedIdx]?.toLowerCase() === 'true' || row[subscribedIdx]?.toLowerCase() === 'yes') : 
        true;
      
      if (isSubscribed) subscribed++;
      else unsubscribed++;

      // New contacts in last 30 days
      if (createdIdx !== -1) {
        const createdDate = new Date(row[createdIdx]);
        if (createdDate > thirtyDaysAgo) {
          newLast30Days++;
        }
      }

      // Tag counts
      if (tagsIdx !== -1) {
        const tags = (row[tagsIdx] || '').split(',').map(t => t.trim()).filter(Boolean);
        tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // For engagement metrics, we'll still need to use KajabiEvent entity
    // since those come from webhooks and aren't in the sheet
    const events = await base44.asServiceRole.entities.KajabiEvent.list('', 100000);
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

    const formSubmissions = recentEvents.filter(e => 
      e.event_type?.includes('form')
    ).length;

    const tagEngagements = recentEvents.filter(e => 
      e.event_type?.includes('tag')
    ).length;

    const conversions = recentEvents.filter(e => 
      e.event_type?.includes('purchase') || e.event_type?.includes('subscription')
    ).length;

    const stats = {
      total,
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
    };

    return Response.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});