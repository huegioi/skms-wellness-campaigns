import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const REFERRAL_PARTNERS_TAG_NAME = 'Referral Partner';

// Sheet config (reused from syncBrokerLeadsSheet)
const SPREADSHEET_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';
const KNOWN_TABS = ['Referral Partners', 'Broker Leads', 'Brokers'];

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const clientId = Deno.env.get('KAJABI_CLIENT_ID');
  const clientSecret = Deno.env.get('KAJABI_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('KAJABI_CLIENT_ID or KAJABI_CLIENT_SECRET is not set');
  }
  const response = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) {
    throw new Error(`Kajabi auth failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  return data.access_token;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  };
}

async function resolveTagId(token, siteId) {
  let page = 1;
  while (true) {
    const url = `${KAJABI_API_URL}/contact_tags?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`;
    console.log(`Fetching contact_tags page ${page}: ${url}`);
    const res = await fetch(url, { headers: headers(token) });
    if (!res.ok) {
      throw new Error(`Failed to list contact_tags (${res.status}): ${await res.text()}`);
    }
    const body = await res.json();
    const tags = body.data || [];
    console.log(`Page ${page}: got ${tags.length} tags`);
    const existing = tags.find(
      (t) => (t.attributes?.name || '').toLowerCase() === REFERRAL_PARTNERS_TAG_NAME.toLowerCase()
    );
    if (existing) {
      console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" found: id=${existing.id}`);
      return existing.id;
    }
    if (!body.links?.next || tags.length === 0) break;
    page++;
  }

  console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" not found — attempting to create via API`);
  const createRes = await fetch(`${KAJABI_API_URL}/contact_tags`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      data: {
        type: 'contact_tags',
        attributes: { name: REFERRAL_PARTNERS_TAG_NAME },
        relationships: {
          site: { data: { type: 'sites', id: String(siteId) } },
        },
      },
    }),
  });
  const createBody = await createRes.text();
  if (!createRes.ok) {
    throw new Error(
      `Tag "${REFERRAL_PARTNERS_TAG_NAME}" does not exist in Kajabi and could not be created via API (${createRes.status}). ` +
      `Please create it manually in Kajabi (Contacts → Tags → New Tag) then re-run this function.`
    );
  }
  const created = JSON.parse(createBody);
  const newId = created.data?.id;
  console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" created: id=${newId}`);
  return newId;
}

/** GET /v1/contacts/{id} — direct lookup by stored Kajabi contact id. Returns null on 404. */
async function getContactById(token, contactId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}`, { headers: headers(token) });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to get contact ${contactId} (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).data;
}

async function findContactByEmail(token, siteId, email) {
  const normalized = email.trim().toLowerCase();
  const url = `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&filter[email]=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    throw new Error(`Failed to search contact by email (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  const contacts = body.data || [];
  return contacts.find((c) => (c.attributes?.email || '').trim().toLowerCase() === normalized) || null;
}

async function findContactByName(token, siteId, name) {
  const normalized = (name || '').trim().toLowerCase();
  if (!normalized) return null;
  const url = `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&filter[name]=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    console.warn(`Targeted name lookup failed (${res.status}) — skipping fallback`);
    return null;
  }
  const body = await res.json();
  const contacts = body.data || [];
  return contacts.find((c) => (c.attributes?.name || '').trim().toLowerCase() === normalized) || null;
}

async function createContact(token, siteId, partner) {
  const attributes = { name: partner.name, email: partner.email };
  if (partner.phone) attributes.phone_number = partner.phone;

  const res = await fetch(`${KAJABI_API_URL}/contacts`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      data: {
        type: 'contacts',
        attributes,
        relationships: {
          site: { data: { type: 'sites', id: String(siteId) } },
        },
      },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 422 || errBody.includes('already been taken')) {
      const taken = new Error('EMAIL_TAKEN');
      taken.kajabiError = errBody;
      throw taken;
    }
    throw new Error(`Failed to create contact (${res.status}): ${errBody}`);
  }
  const body = await res.json();
  return body.data;
}

async function getContactTagIds(token, contactId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    headers: headers(token),
  });
  if (!res.ok) {
    console.warn(`Could not fetch contact tags (${res.status}) — assuming none`);
    return [];
  }
  const body = await res.json();
  return (body.data || []).map((t) => String(t.id));
}

async function addTagToContact(token, contactId, tagId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      data: [{ type: 'contact_tags', id: String(tagId) }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to add tag to contact ${contactId} (${res.status}): ${await res.text()}`);
  }
  console.log(`Tag ${tagId} added to contact ${contactId}`);
}

async function removeTagFromContact(token, contactId, tagId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({
      data: [{ type: 'contact_tags', id: String(tagId) }],
    }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to remove tag from contact ${contactId} (${res.status}): ${await res.text()}`);
  }
  console.log(`Tag ${tagId} removed from contact ${contactId} (or was not present)`);
}

// ── Sheet write-back ──────────────────────────────────────────────────────────

async function writeKajabiContactIdToSheet(base44, partnerEmail, kajabiContactId) {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Resolve tab name
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const tabs = meta.sheets?.map(s => s.properties?.title) || [];
    const sheetName = KNOWN_TABS.find(t => tabs.includes(t)) || tabs[0];
    if (!sheetName) return { success: false, reason: 'no_tab' };

    // Read header to find column indices
    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!1:1')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const headerData = await headerRes.json();
    const headerRow = headerData.values?.[0] || [];
    const lowerHeaders = headerRow.map(h => h.toLowerCase().trim());

    const emailColIdx = lowerHeaders.findIndex(h => h === 'email' || h === 'email address');
    const kajabiColIdx = lowerHeaders.findIndex(h => h === 'kajabi contact id' || h === 'kajabi_contact_id');
    if (emailColIdx === -1 || kajabiColIdx === -1) return { success: false, reason: 'column_not_found' };

    // Read email column to find the partner's row
    const emailColLetter = String.fromCharCode(65 + emailColIdx);
    const emailColRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!' + emailColLetter + ':' + emailColLetter)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const emailColData = await emailColRes.json();
    const emailValues = (emailColData.values || []).map(r => (r[0] || '').trim().toLowerCase());
    const normalizedEmail = partnerEmail.trim().toLowerCase();
    const rowIdx = emailValues.findIndex((e, i) => i > 0 && e === normalizedEmail);
    if (rowIdx === -1) return { success: false, reason: 'row_not_found' };

    // Check current value — skip if already matches (idempotent)
    const kajabiColLetter = String.fromCharCode(65 + kajabiColIdx);
    const rowNum = rowIdx + 1;
    const currentCellRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!' + kajabiColLetter + rowNum + ':' + kajabiColLetter + rowNum)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const currentCellData = await currentCellRes.json();
    const currentValue = (currentCellData.values?.[0]?.[0] || '').trim();
    if (currentValue === String(kajabiContactId)) return { success: true, reason: 'already_set', sheetName };

    // Write the value
    const cellRange = `${sheetName}!${kajabiColLetter}${rowNum}`;
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: cellRange, majorDimension: 'ROWS', values: [[String(kajabiContactId)]] }),
      }
    );
    const updateData = await updateRes.json();
    if (updateData.error) return { success: false, reason: updateData.error.message };
    console.log(`Sheet write-back: ${partnerEmail} → Kajabi Contact ID ${kajabiContactId} at ${cellRange}`);
    return { success: true, cellRange, sheetName };
  } catch (err) {
    console.warn(`Sheet write-back failed for ${partnerEmail}: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    const isAutomationCall = !!payload.event;
    if (!isAutomationCall) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const siteId = Deno.env.get('KAJABI_SITE_ID');
    if (!siteId) {
      return Response.json({ error: 'KAJABI_SITE_ID is not set' }, { status: 500 });
    }

    const referral_partner_id = payload.referral_partner_id || payload.event?.entity_id;
    let partner = payload.data || null;
    if (!partner && referral_partner_id) {
      partner = await base44.asServiceRole.entities.ReferralPartner.get(referral_partner_id);
    }
    if (!partner) {
      return Response.json({ error: 'ReferralPartner not found and no data in payload' }, { status: 404 });
    }

    if (!partner.email) {
      console.log(`Partner "${partner.name}" has no email — skipping`);
      return Response.json({ success: false, skipped: true, reason: 'no_email', partner_name: partner.name });
    }

    const partnerId = partner.id || referral_partner_id;
    console.log(`Syncing partner: ${partner.name} <${partner.email}> (stored kajabi_contact_id: ${partner.kajabi_contact_id || 'none'})`);

    const token = await getAccessToken();
    const tagId = await resolveTagId(token, siteId);

    let contact = null;
    let contactAction;

    // ── 1. If stored kajabi_contact_id, use it directly (skip filter[email]) ──
    if (partner.kajabi_contact_id) {
      contact = await getContactById(token, partner.kajabi_contact_id);
      if (contact) {
        console.log(`Using stored kajabi_contact_id: id=${contact.id}`);
        contactAction = 'found_by_id';
      } else {
        console.log(`Stored kajabi_contact_id ${partner.kajabi_contact_id} returned 404 — resolving afresh`);
      }
    }

    // ── 2. If no stored ID or stale, resolve via exact-email / name / create ──
    if (!contact) {
      contact = await findContactByEmail(token, siteId, partner.email);
      if (contact) {
        console.log(`Exact email match found: id=${contact.id}`);
        contactAction = 'found';
      } else {
        try {
          contact = await createContact(token, siteId, partner);
          console.log(`Kajabi contact created: id=${contact.id}`);
          contactAction = 'created';
        } catch (err) {
          if (err.message === 'EMAIL_TAKEN') {
            contact = await findContactByName(token, siteId, partner.name);
            if (!contact) {
              throw new Error(
                `Email "${partner.email}" is already taken in Kajabi but the existing contact could not be located ` +
                `by exact email or exact name. Resolve manually in Kajabi.`
              );
            }
            console.log(`Located existing contact via name fallback: id=${contact.id}, kajabi_email=${contact.attributes?.email}`);
            contactAction = 'found_by_name';
          } else {
            throw err;
          }
        }
      }

      // Write back to ReferralPartner entity + sheet (only when missing or changed — idempotent)
      if (contact.id !== partner.kajabi_contact_id) {
        await base44.asServiceRole.entities.ReferralPartner.update(partnerId, { kajabi_contact_id: contact.id });
        console.log(`Wrote kajabi_contact_id ${contact.id} to ReferralPartner ${partnerId}`);

        const sheetResult = await writeKajabiContactIdToSheet(base44, partner.email, contact.id);
        if (sheetResult.success) {
          console.log(`Sheet write-back: ${sheetResult.cellRange || 'already set'}`);
        } else {
          console.log(`Sheet write-back skipped: ${sheetResult.reason}`);
        }
      }
    }

    const contactId = contact.id;
    const isActive = partner.is_active === true && partner.partner_status !== 'Inactive';

    // ── Tag management ──
    const currentTagIds = await getContactTagIds(token, contactId);
    const hasTag = currentTagIds.includes(String(tagId));
    let tagAction;

    if (isActive) {
      if (hasTag) {
        console.log(`Tag already present — no change needed`);
        tagAction = 'tag_already_present';
      } else {
        await addTagToContact(token, contactId, tagId);
        tagAction = 'tag_added';
      }
    } else {
      if (hasTag) {
        await removeTagFromContact(token, contactId, tagId);
        tagAction = 'tag_removed';
      } else {
        console.log(`Tag not present and partner inactive — no change needed`);
        tagAction = 'tag_not_present';
      }
    }

    return Response.json({
      success: true,
      partner_name: partner.name,
      partner_email: partner.email,
      kajabi_contact_id: contactId,
      contact_action: contactAction,
      tag_action: tagAction,
      is_active: isActive,
    });

  } catch (error) {
    console.error('syncReferralPartnerToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});