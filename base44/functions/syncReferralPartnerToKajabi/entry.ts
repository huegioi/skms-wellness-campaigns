import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const REFERRAL_PARTNERS_TAG_NAME = 'Referral Partners';

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

/**
 * Resolve or create the "Referral Partners" contact tag.
 * Returns its Kajabi tag id.
 */
async function resolveTagId(token, siteId) {
  // Fetch all tags (paginate if needed) and match by exact name
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
    // No more pages
    if (!body.links?.next || tags.length === 0) break;
    page++;
  }

  // Create it — note: if this 404s, the tag must be created manually in Kajabi first
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
    // Provide actionable guidance — tag creation may not be in scope for this OAuth app
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

/** Search Kajabi for a contact by email; returns contact object or null. */
async function findContactByEmail(token, siteId, email) {
  const url = `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&filter[email]=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    throw new Error(`Failed to search contact (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  const contacts = body.data || [];
  return contacts.length > 0 ? contacts[0] : null;
}

/** Create a new Kajabi contact; returns the contact object. */
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
    throw new Error(`Failed to create contact (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  return body.data;
}

/** Get current tag ids on a contact. Returns array of string ids. */
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

/** Add a tag to a contact. */
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

/** Remove a tag from a contact. 404 is treated as success (tag wasn't there). */
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

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const siteId = Deno.env.get('KAJABI_SITE_ID');
    if (!siteId) {
      return Response.json({ error: 'KAJABI_SITE_ID is not set' }, { status: 500 });
    }

    const payload = await req.json().catch(() => ({}));
    const { referral_partner_id } = payload;
    if (!referral_partner_id) {
      return Response.json({ error: 'referral_partner_id is required' }, { status: 400 });
    }

    const partner = await base44.asServiceRole.entities.ReferralPartner.get(referral_partner_id);
    if (!partner) {
      return Response.json({ error: `ReferralPartner ${referral_partner_id} not found` }, { status: 404 });
    }

    if (!partner.email) {
      console.log(`Partner "${partner.name}" has no email — skipping`);
      return Response.json({ success: false, skipped: true, reason: 'no_email', partner_name: partner.name });
    }

    console.log(`Syncing partner: ${partner.name} <${partner.email}>`);

    const token = await getAccessToken();
    const tagId = await resolveTagId(token, siteId);

    // Upsert contact
    let contact = await findContactByEmail(token, siteId, partner.email);
    let contactAction;
    if (contact) {
      console.log(`Existing Kajabi contact found: id=${contact.id}`);
      contactAction = 'found';
    } else {
      contact = await createContact(token, siteId, partner);
      console.log(`Kajabi contact created: id=${contact.id}`);
      contactAction = 'created';
    }

    const contactId = contact.id;
    const isActive = partner.is_active === true && partner.partner_status !== 'Inactive';

    // Manage tag
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