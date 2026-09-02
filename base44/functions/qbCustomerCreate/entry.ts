import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAccessToken, getRealmId, QB_API_URL } from '../../shared/quickbooksAuth.ts';
import { resolveClientContact, looksLikeOrganization } from '../../shared/clientContact.ts';

// POST /api/functions/qbCustomerCreate
//
// Creates a Customer in QuickBooks from proposal/client data.
// Admin-gated. Never automatic — the frontend only calls this on explicit click.
//
// Customer payload:
//   DisplayName   = company name (the organization is the customer, not the person)
//   CompanyName   = same
//   PrimaryEmailAddr.Address = contact email
//   GivenName / FamilyName = from contact name if it splits into two parts
//   Nothing else — no billing address, no terms.
//
// Before POSTing:
//   1. Re-checks for an existing customer with the same DisplayName (another
//      tab may have created one). If found, returns 409 with the duplicate message.
//   2. If QuickBooks returns fault code 6240 (duplicate DisplayName), surfaces
//      the specific "already exists" message — no retry, no suffix appended.
//
// On success, writes the returned customer ID to the Client record so the next
// proposal for this client resolves on the first try (stored_customer_id path).

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { proposal_id } = body;
    if (!proposal_id) return Response.json({ error: 'proposal_id required' }, { status: 400 });

    // ── Load proposal ──
    const proposal = await base44.asServiceRole.entities.Proposal.get(proposal_id);
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    // ── Load client ──
    let client = null;
    if (proposal.client_id) {
      try { client = await base44.asServiceRole.entities.Client.get(proposal.client_id); } catch {}
    }

    const company = (client?.company || proposal.company || proposal.client_name || '').trim();
    const contactEmail = (proposal.client_email || client?.email || '').toLowerCase().trim();
    // Resolve the HUMAN behind the billing address. `client.name` holds the
    // organization on many records, and splitting that into GivenName/FamilyName
    // wrote "International" / "Fund for Animal Welfare" onto the QuickBooks
    // customer — which then appears on invoices the client receives. No human,
    // no GivenName: the DisplayName (the company) already identifies them.
    const contactName = client
      ? (resolveClientContact(client, contactEmail).name || '')
      : (looksLikeOrganization(proposal.client_name, company) ? '' : (proposal.client_name || '').trim());

    if (!company) return Response.json({ error: 'No company name available for customer creation' }, { status: 400 });
    if (!contactEmail) return Response.json({ error: 'No contact email available' }, { status: 400 });

    const realmId = await getRealmId(base44);
    if (!realmId) return Response.json({ error: 'No realm_id configured' }, { status: 500 });
    const { accessToken } = await getAccessToken(base44);

    // ── Re-check: exact DisplayName query before POSTing ──
    // Another tab may have created this customer while the user was reviewing.
    const escapedCompany = company.replace(/'/g, "\\'");
    const checkQuery = `SELECT Id, DisplayName FROM Customer WHERE DisplayName = '${escapedCompany}' MAXRESULTS 1`;
    const checkResp = await fetch(
      `${QB_API_URL}/${realmId}/query?query=${encodeURIComponent(checkQuery)}`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
    );
    if (checkResp.ok) {
      const checkData = await checkResp.json();
      const existing = checkData.QueryResponse?.Customer?.[0];
      if (existing) {
        return Response.json({
          error: 'A QuickBooks customer already exists with this name. The app couldn\'t match it automatically — open it in QuickBooks and check the email address on it.',
          fault_code: 6240,
          existing_customer_id: existing.Id,
        }, { status: 409 });
      }
    }

    // ── Build customer payload ──
    // DisplayName comes from the company field, NOT the contact name.
    // The organization is the customer; the person is a contact on it.
    const customerPayload = {
      DisplayName: company,
      CompanyName: company,
      PrimaryEmailAddr: { Address: contactEmail },
    };

    const nameParts = contactName.split(/\s+/).filter(Boolean);
    if (nameParts.length >= 2) {
      customerPayload.GivenName = nameParts[0];
      customerPayload.FamilyName = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 1) {
      customerPayload.GivenName = nameParts[0];
    }

    // ── POST to QuickBooks ──
    const createResp = await fetch(`${QB_API_URL}/${realmId}/customer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(customerPayload),
    });

    if (!createResp.ok) {
      const errorText = await createResp.text();
      let errorMsg = 'QuickBooks customer creation failed';
      let faultCode = null;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.Fault?.Error?.[0]?.Message || errorMsg;
        faultCode = errorData.Fault?.Error?.[0]?.code || null;
      } catch {
        errorMsg = errorText;
      }

      // 6240 = duplicate DisplayName — the customer already exists
      if (faultCode === '6240' || /6240/.test(errorText)) {
        return Response.json({
          error: 'A QuickBooks customer already exists with this name. The app couldn\'t match it automatically — open it in QuickBooks and check the email address on it.',
          fault_code: 6240,
        }, { status: 409 });
      }

      return Response.json({ error: errorMsg, fault_code: faultCode }, { status: 502 });
    }

    const createResult = await createResp.json();
    const customerId = createResult.Customer?.Id;

    if (!customerId) {
      return Response.json({ error: 'QuickBooks did not return a customer ID' }, { status: 502 });
    }

    // ── Write customer ID to Client record ──
    if (proposal.client_id) {
      await base44.asServiceRole.entities.Client.update(proposal.client_id, {
        quickbooks_customer_id: customerId,
      });
    }

    return Response.json({
      success: true,
      customer_id: customerId,
      message: 'Customer created in QuickBooks.',
    });
  } catch (error) {
    console.error('qbCustomerCreate error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}