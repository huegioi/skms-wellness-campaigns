import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// The Broker Leads spreadsheet file ID
const SPREADSHEET_FILE_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    // ACK the initial sync handshake from Google
    const state = body.data?._provider_meta?.['x-goog-resource-state'];
    console.log('Drive webhook received, state:', state);
    if (state === 'sync') {
      return Response.json({ status: 'sync_ack' });
    }

    // Get Google Drive access token to fetch change page token
    const { accessToken: driveToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${driveToken}` };

    // Load persisted page token from SyncState entity
    const existing = await base44.asServiceRole.entities.SyncState.list();
    let syncRecord = existing.length > 0 ? existing[0] : null;

    if (!syncRecord) {
      // First run: bootstrap the page token
      const tokenRes = await fetch(
        'https://www.googleapis.com/drive/v3/changes/startPageToken',
        { headers: authHeader }
      );
      const { startPageToken } = await tokenRes.json();
      await base44.asServiceRole.entities.SyncState.create({ page_token: startPageToken, label: 'broker_sheet' });
      console.log('Initialized SyncState with startPageToken:', startPageToken);
      return Response.json({ status: 'initialized' });
    }

    // Fetch incremental changes since last token
    const baseUrl = `https://www.googleapis.com/drive/v3/changes?fields=changes(fileId),newStartPageToken,nextPageToken`;
    let changesUrl = baseUrl + `&pageToken=${syncRecord.page_token}`;
    const changedFileIds = new Set();
    let newPageToken = null;

    while (changesUrl) {
      const changesRes = await fetch(changesUrl, { headers: authHeader });
      if (!changesRes.ok) {
        console.error('Drive changes API error:', await changesRes.text());
        return Response.json({ status: 'api_error' });
      }
      const page = await changesRes.json();
      (page.changes || []).forEach(c => { if (c.fileId) changedFileIds.add(c.fileId); });
      if (page.newStartPageToken) newPageToken = page.newStartPageToken;
      changesUrl = page.nextPageToken ? baseUrl + `&pageToken=${page.nextPageToken}` : null;
    }

    console.log('Changed file IDs:', [...changedFileIds]);

    // Only proceed if our spreadsheet was among the changed files
    if (changedFileIds.has(SPREADSHEET_FILE_ID)) {
      console.log('Broker Leads sheet changed — triggering syncBrokerLeadsSheet');
      // Invoke the existing sync function as service role
      await base44.asServiceRole.functions.invoke('syncBrokerLeadsSheet', {});
      console.log('syncBrokerLeadsSheet triggered successfully');
    } else {
      console.log('Changed files did not include the Broker Leads sheet — skipping');
    }

    // Persist the new page token
    if (newPageToken) {
      await base44.asServiceRole.entities.SyncState.update(syncRecord.id, { page_token: newPageToken });
    }

    return Response.json({ status: 'ok', triggered: changedFileIds.has(SPREADSHEET_FILE_ID) });
  } catch (error) {
    console.error('onBrokerSheetChanged error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});