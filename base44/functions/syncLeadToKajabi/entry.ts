import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const PARTNER_LEAD_TAG_NAME = 'Partner Lead';

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
      (t) => (t.attributes?.name || '').toLowerCase() === PARTNER_LEAD_TAG_NAME.toLowerCase()
    );
    if (existing) {
      console.log(`Tag "${PARTNER_LEAD_TAG_NAME}" found: id=${existing.id}`);
      return existing.id;
    }
    if (!body.links?.next || tags.length === 0) break;
    page++;
  }

  console.log(`Tag "${PARTNER_LEAD_TAG_NAME}" not found — attempting to create via API`);
  const createRes = await fetch(`${KAJABI_API_URL}/contact_tags`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      data: {
        type: 'contact_tags',
        attributes: { name: PARTNER_LEAD_TAG_NAME },
        relationships: {
          site: { data: { type: 'sites', id: String(siteId) } },
        },
      },
    }),
  });
  const createBody = await createRes.text();
  if (!createRes.ok) {
    throw new Error(
      `Tag "${PARTNER_LEAD_TAG_NAME}" does not exist in Kajabi and could not be created via API (${createRes.status}). ` +
      `Please create it manually in Kajabi (Contacts → Tags → New Tag) then re-run this function.`
    );
  }
  const created = JSON.parse(createBody);
  const newId = created.data?.id;
  console.log(`Tag "${PARTNER_LEAD_TAG_NAME}" created: id=${newId}`);
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

async function createContact(token, siteId, lead) {
  const attributes = { name: lead.name, email: lead.email, subscribed: true };
  if (lead.phone) attributes.phone_number = lead.phone;

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

    const lead_id = payload.lead_id || payload.event?.entity_id;
    let lead = payload.data || null;
    if (!lead && lead_id) {
      lead = await base44.asServiceRole.entities.Lead.get(lead_id);
    }
    if (!lead) {
      return Response.json({ error: 'Lead not found and no data in payload' }, { status: 404 });
    }

    // Only sync broker and broker_lead types
    if (lead.lead_type !== 'broker' && lead.lead_type !== 'broker_lead') {
      console.log(`Lead "${lead.name}" has lead_type "${lead.lead_type}" — skipping (only broker/broker_lead synced)`);
      return Response.json({ success: false, skipped: true, reason: 'wrong_lead_type', lead_name: lead.name, lead_type: lead.lead_type });
    }

    if (!lead.email) {
      console.log(`Lead "${lead.name}" has no email — skipping`);
      return Response.json({ success: false, skipped: true, reason: 'no_email', lead_name: lead.name });
    }

    // Demo records are never synced to Kajabi
    if (lead.is_demo) {
      return Response.json({ success: false, skipped: true, reason: 'demo_record', lead_name: lead.name });
    }

    const leadId = lead.id || lead_id;
    console.log(`Syncing lead: ${lead.name} <${lead.email}> (stored kajabi_contact_id: ${lead.kajabi_contact_id || 'none'})`);

    const token = await getAccessToken();
    const tagId = await resolveTagId(token, siteId);

    let contact = null;
    let contactAction;

    // ── 1. If stored kajabi_contact_id, use it directly (skip filter[email]) ──
    if (lead.kajabi_contact_id) {
      contact = await getContactById(token, lead.kajabi_contact_id);
      if (contact) {
        console.log(`Using stored kajabi_contact_id: id=${contact.id}`);
        contactAction = 'found_by_id';
      } else {
        console.log(`Stored kajabi_contact_id ${lead.kajabi_contact_id} returned 404 — resolving afresh`);
      }
    }

    // ── 2. If no stored ID or stale, resolve via exact-email / name / create ──
    if (!contact) {
      contact = await findContactByEmail(token, siteId, lead.email);
      if (contact) {
        console.log(`Exact email match found: id=${contact.id}`);
        contactAction = 'found';
      } else {
        try {
          contact = await createContact(token, siteId, lead);
          console.log(`Kajabi contact created: id=${contact.id}`);
          contactAction = 'created';
        } catch (err) {
          if (err.message === 'EMAIL_TAKEN') {
            contact = await findContactByName(token, siteId, lead.name);
            if (!contact) {
              throw new Error(
                `Email "${lead.email}" is already taken in Kajabi but the existing contact could not be located ` +
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

      // Write back to Lead entity (only when missing or changed — idempotent)
      if (contact.id !== lead.kajabi_contact_id) {
        await base44.asServiceRole.entities.Lead.update(leadId, { kajabi_contact_id: contact.id });
        console.log(`Wrote kajabi_contact_id ${contact.id} to Lead ${leadId}`);
      }
    }

    const contactId = contact.id;
    const isActive = lead.partner_status !== 'inactive';

    // ── Tag management ("Partner Lead" only) ──
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
        console.log(`Tag not present and lead inactive — no change needed`);
        tagAction = 'tag_not_present';
      }
    }

    return Response.json({
      success: true,
      lead_name: lead.name,
      lead_email: lead.email,
      lead_type: lead.lead_type,
      kajabi_contact_id: contactId,
      contact_action: contactAction,
      tag_action: tagAction,
      is_active: isActive,
    });

  } catch (error) {
    console.error('syncLeadToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});