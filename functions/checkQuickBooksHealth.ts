import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only function
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const refreshToken = Deno.env.get('QUICKBOOKS_REFRSH_TOKEN');
    const realmId = Deno.env.get('QUICKBOOK_REALM_ID');

    if (!clientId || !clientSecret || !refreshToken || !realmId) {
      return Response.json({
        status: 'error',
        message: 'QuickBooks credentials not configured',
        needsReconnect: true
      });
    }

    // Try to get a new access token
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
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

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      let errorMsg = 'Failed to refresh token';
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error_description || errorData.error || errorMsg;
      } catch {
        errorMsg = errorText;
      }

      // Send email alert to admin
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'SKMS Wellness CRM',
          to: user.email,
          subject: '🚨 QuickBooks Connection Failed',
          body: `
            <h2>QuickBooks Connection Error</h2>
            <p>The QuickBooks refresh token has expired or is invalid.</p>
            <p><strong>Error:</strong> ${errorMsg}</p>
            <p>Please reconnect QuickBooks in the Dashboard:</p>
            <ol>
              <li>Go to Dashboard</li>
              <li>Click "Sync with QuickBooks" button</li>
              <li>Follow the OAuth reconnection flow</li>
            </ol>
            <p>Note: QuickBooks refresh tokens expire after 100 days of inactivity.</p>
          `
        });
      } catch (emailError) {
        console.error('Failed to send alert email:', emailError);
      }

      return Response.json({
        status: 'error',
        message: errorMsg,
        needsReconnect: true,
        emailSent: true
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Test the connection with a simple API call
    const testResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return Response.json({
        status: 'warning',
        message: 'Token refreshed but API test failed',
        details: errorText,
        needsReconnect: false
      });
    }

    const companyInfo = await testResponse.json();

    return Response.json({
      status: 'healthy',
      message: 'QuickBooks connection is working properly',
      companyName: companyInfo.CompanyInfo?.CompanyName,
      realmId: realmId,
      needsReconnect: false,
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    console.error('QuickBooks health check error:', error);
    return Response.json({ 
      status: 'error',
      message: error.message,
      needsReconnect: true
    }, { status: 500 });
  }
});