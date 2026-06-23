import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const REFERRAL_PARTNERS_TAG_NAME = 'Referral Partner';
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken() {
  const clientId = Deno.env.get('KAJABI_CLIENT_ID');
  const clientSecret = Deno.env.get('KAJABI_CLIENT_SECRET');
  const response = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!response.ok) throw new Error(`Kajabi auth failed (${response.status}): ${await response.text()}`);
  return (await response.json()).access_token;
}

function apiHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  };
}

async function resolveTagId(token, siteId) {
  let page = 1;
  while (true) {
    const res = await fetch(`${KAJABI_API_URL}/contact_tags?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`, { headers: apiHeaders(token) });
    if (!res.ok) throw new Error(`Failed to list contact_tags (${res.status})`);
    const body = await res.json();
    const tags = body.data || [];
    const existing = tags.find((t) => (t.attributes?.name || '').toLowerCase() === REFERRAL_PARTNERS_TAG_NAME.toLowerCase());
    if (existing) return existing.id;
    if (!body.links?.next || tags.length === 0) break;
    page++;
  }
  throw new Error(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" not found in Kajabi. Please create it manually first.`);
}

async function findContactByEmail(token, siteId, email) {
  const res = await fetch(`${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&filter[email]=${encodeURIComponent(email)}`, { headers: apiHeaders(token) });
  if (!res.ok) throw new Error(`Failed to search contact (${res.status})`);
  const body = await res.json();
  return (body.data || [])[0] || null;
}

async function createContact(token, siteId, partner) {
  const attributes = { name: partner.name, email: partner.email };
  if (partner.phone) attributes.phone_number = partner.phone;
  const res = await fetch(`${KAJABI_API_URL}/contacts`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({ data: { type: 'contacts', attributes, relationships: { site: { data: { type: 'sites', id: String(siteId) } } } } }),
  });
  if (!res.ok) throw new Error(`Failed to create contact (${res.status})`);
  return (await res.json()).data;
}

async function getContactTagIds(token, contactId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, { headers: apiHeaders(token) });
  if (!res.ok) return [];
  return ((await res.json()).data || []).map((t) => String(t.id));
}

async function addTagToContact(token, contactId, tagId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({ data: [{ type: 'contact_tags', id: String(tagId) }] }),
  });
  if (!res.ok) throw new Error(`Failed to add tag to contact ${contactId} (${res.status})`);
}

async function syncPartner(token, siteId, tagId, partner) {
  if (!partner.email) return { action: 'skipped', reason: 'no_email' };

  let contact = await findContactByEmail(token, siteId, partner.email);
  let contactAction;
  if (contact) {
    contactAction = 'found';
  } else {
    contact = await createContact(token, siteId, partner);
    contactAction = 'created';
  }

  const isActive = partner.is_active === true && partner.partner_status !== 'Inactive';
  const currentTagIds = await getContactTagIds(token, contact.id);
  const hasTag = currentTagIds.includes(String(tagId));
  let tagAction = 'no_change';

  if (isActive && !hasTag) {
    await addTagToContact(token, contact.id, tagId);
    tagAction = 'tag_added';
  }

  return { action: 'synced', contactAction, tagAction };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const siteId = Deno.env.get('KAJABI_SITE_ID');
    const token = await getAccessToken();
    const tagId = await resolveTagId(token, siteId);

    const partners = await base44.asServiceRole.entities.ReferralPartner.list();
    console.log(`Found ${partners.length} referral partners to sync`);

    const results = { contacts_created: 0, contacts_found: 0, tags_applied: 0, skipped: 0, failed: [] };

    for (let i = 0; i < partners.length; i += BATCH_SIZE) {
      const batch = partners.slice(i, i + BATCH_SIZE);
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map(p => p.name).join(', ')}`);

      await Promise.all(batch.map(async (partner) => {
        try {
          const result = await syncPartner(token, siteId, tagId, partner);
          if (result.action === 'skipped') {
            results.skipped++;
          } else {
            if (result.contactAction === 'created') results.contacts_created++;
            else results.contacts_found++;
            if (result.tagAction === 'tag_added') results.tags_applied++;
          }
        } catch (err) {
          results.failed.push({ name: partner.name, email: partner.email || '(no email)', error: err.message });
          console.error(`Failed: ${partner.name} — ${err.message}`);
        }
      }));

      if (i + BATCH_SIZE < partners.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`Done: created=${results.contacts_created}, found=${results.contacts_found}, tagged=${results.tags_applied}, skipped=${results.skipped}, failed=${results.failed.length}`);

    return Response.json({
      success: true,
      total: partners.length,
      contacts_created: results.contacts_created,
      contacts_found: results.contacts_found,
      tags_applied: results.tags_applied,
      skipped_no_email: results.skipped,
      failed_count: results.failed.length,
      failed: results.failed,
    });

  } catch (error) {
    console.error('backfillReferralPartnersToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});