import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, QB_API_URL } from '../../shared/quickbooksAuth.ts';
import { isExcludedDomain } from '../../shared/emailDomain.ts';

// POST /api/functions/qbCustomerFindSimilar
//
// Given a company name and email, runs LIKE queries against the QuickBooks
// Customer table to find near-miss matches that exact resolution missed.
//
// Two sequential queries (never concurrent — Intuit rotates the refresh token
// on every use; two in flight strand the connection):
//   1. DisplayName LIKE '%company%' — partial company name match
//   2. PrimaryEmailAddr LIKE '%@domain' — same email domain
//
// Returns { similar_customers: [{ id, display_name, email }] }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { company, email } = body;
    if (!company && !email) {
      return Response.json({ error: 'company or email required' }, { status: 400 });
    }

    const realmId = await getRealmId(base44);
    if (!realmId) return Response.json({ error: 'No realm_id configured' }, { status: 500 });
    const { accessToken } = await getAccessToken(base44);

    const results = [];
    const seenIds = new Set();

    // Query 1: partial DisplayName match against company name
    const companyName = (company || '').trim();
    if (companyName) {
      const escaped = companyName.replace(/'/g, "\\'");
      const query = `SELECT Id, DisplayName, PrimaryEmailAddr FROM Customer WHERE DisplayName LIKE '%${escaped}%' MAXRESULTS 25`;
      const resp = await fetch(
        `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const customers = data.QueryResponse?.Customer || [];
        for (const c of customers) {
          if (!seenIds.has(c.Id)) {
            seenIds.add(c.Id);
            results.push({
              id: c.Id,
              display_name: c.DisplayName || null,
              email: c.PrimaryEmailAddr?.Address || null,
            });
          }
        }
      }
    }

    // Query 2: email domain match (skip for free-mail providers)
    const domain = email ? email.split('@')[1] : null;
    if (domain && !isExcludedDomain(domain)) {
      const query = `SELECT Id, DisplayName, PrimaryEmailAddr FROM Customer WHERE PrimaryEmailAddr LIKE '%@${domain}' MAXRESULTS 25`;
      const resp = await fetch(
        `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const customers = data.QueryResponse?.Customer || [];
        for (const c of customers) {
          if (!seenIds.has(c.Id)) {
            seenIds.add(c.Id);
            results.push({
              id: c.Id,
              display_name: c.DisplayName || null,
              email: c.PrimaryEmailAddr?.Address || null,
            });
          }
        }
      }
    }

    return Response.json({ similar_customers: results });
  } catch (error) {
    console.error('qbCustomerFindSimilar error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}