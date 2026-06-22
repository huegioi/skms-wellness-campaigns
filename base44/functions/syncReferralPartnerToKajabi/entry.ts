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
    const err = await response.text();
    throw new Error(`Kajabi auth failed (${response.status}): ${err}`);
  }
  const data = await response.json();
  return data.access_token;
}

// ── Kajabi helpers ────────────────────────────────────────────────────────────

function kajabiHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  };
}

/** Resolve or create the "Referral Partners" contact tag; returns its Kajabi id. */
async function resolveTagId(token, siteId) {
  // List all tags for the site
  const res = await fetch(`${KAJABI_API_URL}/contact_tags?filter[site_id]=${siteId}`, {
    headers: kajabiHeaders(token),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list contact tags (${res.status}): ${err}`);
  }
  const body = await res.json();
  const tags = body.data || [];
  const existing = tags.find(
    (t) => t.attributes?.name?.toLowerCase() === REFERRAL_PARTNERS_TAG_NAME.toLowerCase()
  );
  if (existing) {
    console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" found with id ${existing.id}`);
    return existing.id;
  }

  // Create the tag
  console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" not found — creating it`);
  const createRes = await fetch(`${KAJABI_API_URL}/contact_tags`, {
    method: 'POST',
    headers: kajabiHeaders(token),
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
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create contact tag (${createRes.status}): ${err}`);
  }
  const created = await createRes.json();
  const newId = created.data?.id;
  console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" created with id ${newId}`);
  return newId;
}

/** Search Kajabi for a contact by email; returns the contact object or null. */
async function findContactByEmail(token, siteId, email) {
  const url = `${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&filter[email]=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: kajabiHeaders(token) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to search contact by email (${res.status}): ${err}`);
  }
  const body = await res.json();
  const contacts = body.data || [];
  return contacts.length > 0 ? contacts[0] : null;
}

/** Create a new Kajabi contact; returns the created contact object. */
async function createContact(token, siteId, partner) {
  const attributes = {
    name: partner.name,
    email: partner.email,
  };
  if (partner.phone) attributes.phone_number = partner.phone;

  const res = await fetch(`${KAJABI_API_URL}/contacts`, {
    method: 'POST',
    headers: kajabiHeaders(token),
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
    const err = await res.text();
    throw new Error(`Failed to create Kajabi contact (${res.status}): ${err}`);
  }
  const body = await res.json();
  return body.data;
}

/** Add a tag to a Kajabi contact. */
async function addTagToContact(token, contactId, tagId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    method: 'POST',
    headers: kajabiHeaders(token),
    body: JSON.stringify({
      data: [{ type: 'contact_tags', id: String(tagId) }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to add tag to contact ${contactId} (${res.status}): ${err}`);
  }
  console.log(`Tag ${tagId} added to contact ${contactId}`);
}

/** Remove a tag from a Kajabi contact. */
async function removeTagFromContact(token, contactId, tagId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    method: 'DELETE',
    headers: kajabiHeaders(token),
    body: JSON.stringify({
      data: [{ type: 'contact_tags', id: String(tagId) }],
    }),
  });
  // 404 = tag wasn't on the contact anyway; treat as success
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to remove tag from contact ${contactId} (${res.status}): ${err}`);
  }
  console.log(`Tag ${tagId} removed from contact ${contactId} (or was not present)`);
}

/** Fetch current tags on a Kajabi contact; returns array of tag ids. */
async function getContactTagIds(token, contactId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    headers: kajabiHeaders(token),
  });
  if (!res.ok) {
    console.warn(`Could not fetch tags for contact ${contactId}: ${res.status}`);
    return [];
  }
  const body = await res.json();
  return (body.data || []).map((t) => String(t.id));
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
      return Response.json({ error: 'KAJABI_SITE_ID secret is not set' }, { status: 500 });
    }

    const payload = await req.json().catch(() => ({}));
    const { referral_partner_id } = payload;

    if (!referral_partner_id) {
      return Response.json({ error: 'referral_partner_id is required' }, { status: 400 });
    }

    // Load partner record
    const partner = await base44.asServiceRole.entities.ReferralPartner.get(referral_partner_id);
    if (!partner) {
      return Response.json({ error: `ReferralPartner ${referral_partner_id} not found` }, { status: 404 });
    }

    if (!partner.email) {
      console.log(`Partner ${partner.name} (${referral_partner_id}) has no email — skipping`);
      return Response.json({ success: false, skipped: true, reason: 'no_email', partner_name: partner.name });
    }

    console.log(`Syncing partner: ${partner.name} <${partner.email}>`);

    // Auth
    const token = await getAccessToken();

    // Resolve tag (look up or create once)
    const tagId = await resolveTagId(token, siteId);

    // Upsert contact
    let contact = await findContactByEmail(token, siteId, partner.email);
    let action;
    if (contact) {
      console.log(`Contact found in Kajabi with id ${contact.id}`);
      action = 'found';
    } else {
      console.log(`Contact not found — creating`);
      contact = await createContact(token, siteId, partner);
      action = 'created';
      console.log(`Contact created with id ${contact.id}`);
    }

    const contactId = contact.id;

    // Determine active status
    const isActive = partner.is_active === true && partner.partner_status !== 'Inactive';

    if (isActive) {
      // Add tag if not already present
      const currentTagIds = await getContactTagIds(token, contactId);
      if (currentTagIds.includes(String(tagId))) {
        console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" already on contact — no change needed`);
      } else {
        await addTagToContact(token, contactId, tagId);
      }
    } else {
      // Remove tag if present
      await removeTagFromContact(token, contactId, tagId);
    }

    const tagAction = isActive ? 'tag_added_or_present' : 'tag_removed_or_absent';
    console.log(`Done: contact ${action}, tag action: ${tagAction}`);

    return Response.json({
      success: true,
      partner_name: partner.name,
      partner_email: partner.email,
      kajabi_contact_id: contactId,
      contact_action: action,
      tag_action: tagAction,
      is_active: isActive,
    });

  } catch (error) {
    console.error('syncReferralPartnerToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});