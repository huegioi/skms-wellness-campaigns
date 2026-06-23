import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const REFERRAL_PARTNERS_TAG_NAME = 'Referral Partner';
const PAGE_SIZE = 500;
const MAX_SCAN_PAGES = 20; // Safety limit — 10,000 contacts

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
    if (existing) {
      console.log(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" found: id=${existing.id}`);
      return existing.id;
    }
    if (!body.links?.next || tags.length === 0) break;
    page++;
  }
  throw new Error(`Tag "${REFERRAL_PARTNERS_TAG_NAME}" not found in Kajabi. Please create it manually first.`);
}

/**
 * Single-pass scan. For each page, checks both:
 *  - Exact email match (lowercased)  → emailMap
 *  - Exact name match (lowercased)   → nameMap (fallback for emails stored differently)
 * Stops early once all targets are found OR MAX_SCAN_PAGES reached.
 */
async function findContactsByScan(token, siteId, partnersWithEmail) {
  const emailFound = new Map();    // lowercase email -> { id, email, name, _created: false }
  const nameFound = new Map();     // lowercase name -> { id, email, name, _created: false }
  const emailsLooking = new Set();
  const namesLooking = new Map();  // lowercase name -> partner email (to link back)
  for (const { partner } of partnersWithEmail) {
    const normEmail = partner.email.trim().toLowerCase();
    emailsLooking.add(normEmail);
    const normName = (partner.name || '').trim().toLowerCase();
    if (normName) namesLooking.set(normName, normEmail);
  }
  let remaining = emailsLooking.size;
  let page = 1;

  while (remaining > 0 && page <= MAX_SCAN_PAGES) {
    const res = await fetch(`${KAJABI_API_URL}/contacts?filter[site_id]=${siteId}&page[size]=${PAGE_SIZE}&page[number]=${page}`, { headers: apiHeaders(token) });
    if (!res.ok) {
      console.warn(`Scan: page ${page} failed (${res.status}) — stopping`);
      break;
    }
    const body = await res.json();
    const contacts = body.data || [];
    if (contacts.length === 0) break;

    let foundThisPage = 0;
    for (const c of contacts) {
      const email = (c.attributes?.email || '').trim().toLowerCase();
      const name = (c.attributes?.name || '').trim().toLowerCase();

      if (email && emailsLooking.has(email)) {
        emailFound.set(email, { id: c.id, email: c.attributes?.email, name: c.attributes?.name, _created: false });
        emailsLooking.delete(email);
        remaining--;
        foundThisPage++;
      } else if (name && namesLooking.has(name) && !nameFound.has(name)) {
        // Name match — record it as a fallback (email differs)
        nameFound.set(name, { id: c.id, email: c.attributes?.email, name: c.attributes?.name, _created: false });
        remaining--;
        foundThisPage++;
      }
    }
    console.log(`Scan page ${page}: ${contacts.length} contacts — found ${foundThisPage} this page, ${emailFound.size + nameFound.size}/${partnersWithEmail.length} total, ${remaining} remaining`);
    if (!body.links?.next) break;
    page++;
  }

  if (remaining > 0) {
    console.log(`Scan stopped at page ${page - 1} (${remaining} partners still unmatched)`);
  }
  return { emailFound, nameFound };
}

async function createContact(token, siteId, partner) {
  const attributes = { name: partner.name, email: partner.email };
  if (partner.phone) attributes.phone_number = partner.phone;
  const res = await fetch(`${KAJABI_API_URL}/contacts`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({ data: { type: 'contacts', attributes, relationships: { site: { data: { type: 'sites', id: String(siteId) } } } } }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    if (errBody.includes('already been taken') || res.status === 422) {
      throw new Error(`EMAIL_TAKEN: ${errBody}`);
    }
    throw new Error(`Failed to create contact (${res.status}): ${errBody}`);
  }
  const created = (await res.json()).data;
  return { id: created.id, email: created.attributes?.email, name: created.attributes?.name, _created: true };
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

    const partnersWithEmail = [];
    for (let i = 0; i < partners.length; i++) {
      if (partners[i].email) {
        partnersWithEmail.push({ index: i, partner: partners[i] });
      }
    }

    console.log(`Scanning Kajabi contacts for ${partnersWithEmail.length} partner emails...`);
    const { emailFound, nameFound } = await findContactsByScan(token, siteId, partnersWithEmail);

    // Build the final contact map: prefer exact email match, fall back to name match
    const contactMap = new Map(); // lowercase partner email -> contact
    const perPartner = [];
    let contactsFound = 0, contactsCreated = 0, tagsApplied = 0, skipped = 0, failed = 0;

    for (const { partner } of partnersWithEmail) {
      const normEmail = partner.email.trim().toLowerCase();
      const normName = (partner.name || '').trim().toLowerCase();

      // 1. Exact email match
      let contact = emailFound.get(normEmail) || null;

      // 2. Name match fallback
      if (!contact && nameFound.has(normName)) {
        contact = nameFound.get(normName);
        console.log(`Name match for ${partner.email} → contact_id=${contact.id}, kajabi_email=${contact.email}`);
      }

      // 3. Create if not found
      if (!contact) {
        try {
          contact = await createContact(token, siteId, partner);
          console.log(`Created: ${partner.email} → contact_id=${contact.id}`);
        } catch (err) {
          if (err.message.startsWith('EMAIL_TAKEN')) {
            // Email exists in Kajabi but wasn't found by scan (stored differently) and can't be created
            console.error(`FAIL  [${partner.email}] — email exists in Kajabi but could not be located (stored differently)`);
            perPartner.push({
              partner_name: partner.name,
              partner_email: partner.email,
              kajabi_contact_id: null,
              kajabi_contact_email: null,
              contact_action: 'failed_email_taken_unlocatable',
              tag_action: 'skipped',
            });
            failed++;
            continue;
          }
          throw err;
        }
      }

      const contactAction = contact._created ? 'created' : 'found';

      // Apply tag
      const isActive = partner.is_active === true && partner.partner_status !== 'Inactive';
      const currentTagIds = await getContactTagIds(token, contact.id);
      const hasTag = currentTagIds.includes(String(tagId));
      let tagAction = 'no_change';

      if (isActive && !hasTag) {
        await addTagToContact(token, contact.id, tagId);
        tagAction = 'tag_added';
        tagsApplied++;
      }

      if (contactAction === 'created') contactsCreated++;
      else contactsFound++;

      perPartner.push({
        partner_name: partner.name,
        partner_email: partner.email,
        kajabi_contact_id: contact.id,
        kajabi_contact_email: contact.email,
        contact_action: contactAction,
        tag_action: tagAction,
      });
      console.log(`OK    [${partner.email}] → contact_id=${contact.id}, contact_email=${contact.email}, action=${contactAction}, tag=${tagAction}`);
    }

    // Add skipped (no email) partners
    for (let i = 0; i < partners.length; i++) {
      if (!partners[i].email) {
        skipped++;
        perPartner.push({ partner_name: partners[i].name, partner_email: null, status: 'skipped', reason: 'no_email' });
      }
    }

    console.log(`Done: found=${contactsFound}, created=${contactsCreated}, tagged=${tagsApplied}, failed=${failed}, skipped=${skipped}`);

    return Response.json({
      success: failed === 0,
      total: partners.length,
      contacts_found: contactsFound,
      contacts_created: contactsCreated,
      tags_applied: tagsApplied,
      skipped_no_email: skipped,
      failed_count: failed,
      failed: perPartner.filter((p) => p.contact_action === 'failed_email_taken_unlocatable'),
      per_partner: perPartner,
    });

  } catch (error) {
    console.error('backfillReferralPartnersToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});