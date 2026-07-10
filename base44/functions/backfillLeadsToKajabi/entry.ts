import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const PARTNER_LEAD_TAG_NAME = 'Partner Lead';
const PAGE_SIZE = 500;
const MAX_SCAN_PAGES = 20;

// ── Auth ─────────────────────────────────────────────────────────────────────

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
  const targetName = PARTNER_LEAD_TAG_NAME;
  let page = 1;
  while (true) {
    const res = await fetch(`${KAJABI_API_URL}/contact_tags?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`, { headers: apiHeaders(token) });
    if (!res.ok) throw new Error(`Failed to list contact_tags (${res.status})`);
    const body = await res.json();
    const tags = body.data || [];
    const existing = tags.find((t) => (t.attributes?.name || '').toLowerCase() === targetName.toLowerCase());
    if (existing) {
      console.log(`Tag "${targetName}" found: id=${existing.id}`);
      return existing.id;
    }
    if (!body.links?.next || tags.length === 0) break;
    page++;
  }
  throw new Error(`Tag "${targetName}" not found in Kajabi. Please create it manually first.`);
}

// ── Contact operations ──────────────────────────────────────────────────────

async function getContactById(token, contactId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}`, { headers: apiHeaders(token) });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to get contact ${contactId} (${res.status})`);
  }
  return (await res.json()).data;
}

async function findContactsByScan(token, siteId, leadsToResolve) {
  const emailFound = new Map();
  const nameFound = new Map();
  const emailsLooking = new Set();
  const namesLooking = new Map();
  for (const lead of leadsToResolve) {
    const normEmail = lead.email.trim().toLowerCase();
    emailsLooking.add(normEmail);
    const normName = (lead.name || '').trim().toLowerCase();
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
        emailFound.set(email, { id: c.id, email: c.attributes?.email, name: c.attributes?.name, subscribed: c.attributes?.subscribed, _created: false });
        emailsLooking.delete(email);
        remaining--;
        foundThisPage++;
      } else if (name && namesLooking.has(name) && !nameFound.has(name)) {
        nameFound.set(name, { id: c.id, email: c.attributes?.email, name: c.attributes?.name, subscribed: c.attributes?.subscribed, _created: false });
        remaining--;
        foundThisPage++;
      }
    }
    console.log(`Scan page ${page}: ${contacts.length} contacts — found ${foundThisPage} this page, ${emailFound.size + nameFound.size} total, ${remaining} remaining`);
    if (!body.links?.next) break;
    page++;
  }

  if (remaining > 0) {
    console.log(`Scan stopped at page ${page - 1} (${remaining} leads still unmatched)`);
  }
  return { emailFound, nameFound };
}

async function createContact(token, siteId, lead) {
  const attributes = { name: lead.name, email: lead.email, subscribed: true };
  if (lead.phone) attributes.phone_number = lead.phone;
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
  return { id: created.id, email: created.attributes?.email, name: created.attributes?.name, subscribed: true, _created: true };
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

async function removeTagFromContact(token, contactId, tagId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    method: 'DELETE',
    headers: apiHeaders(token),
    body: JSON.stringify({ data: [{ type: 'contact_tags', id: String(tagId) }] }),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to remove tag from contact ${contactId} (${res.status})`);
}

async function subscribeContact(token, contactId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}`, {
    method: 'PATCH',
    headers: apiHeaders(token),
    body: JSON.stringify({
      data: {
        id: String(contactId),
        type: 'contacts',
        attributes: { subscribed: true },
      },
    }),
  });
  if (!res.ok) throw new Error(`Failed to subscribe contact ${contactId} (${res.status}): ${await res.text()}`);
  console.log(`Contact ${contactId} subscribed to marketing emails`);
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
    const token = await getAccessToken();
    const tagId = await resolveTagId(token, siteId);

    // Fetch all broker + broker_lead leads
    const brokerLeads = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker' }, '-created_date', 1000);
    const brokerLeadLeads = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }, '-created_date', 1000);
    const allLeadsRaw = [...brokerLeads, ...brokerLeadLeads];
    const leads = allLeadsRaw.filter(l => !l.is_demo);
    console.log(`Found ${allLeadsRaw.length} broker/broker_lead leads to sync (${brokerLeads.length} broker, ${brokerLeadLeads.length} broker_lead) — ${allLeadsRaw.length - leads.length} demo record(s) excluded`);

    // Separate leads: those with stored kajabi_contact_id vs those without
    const leadsToResolve = [];
    const contactMap = new Map(); // lowercase email -> { id, email, name, _created }
    let foundById = 0;

    for (const lead of leads) {
      if (!lead.email) continue;
      const normEmail = lead.email.trim().toLowerCase();

      if (lead.kajabi_contact_id) {
        const contact = await getContactById(token, lead.kajabi_contact_id);
        if (contact) {
          contactMap.set(normEmail, { id: contact.id, email: contact.attributes?.email, name: contact.attributes?.name, subscribed: contact.attributes?.subscribed, _created: false });
          foundById++;
          console.log(`GET by stored ID: ${lead.email} → contact_id=${contact.id}`);
        } else {
          console.log(`Stored kajabi_contact_id ${lead.kajabi_contact_id} for ${lead.email} returned 404 — will resolve via scan`);
          leadsToResolve.push(lead);
        }
      } else {
        leadsToResolve.push(lead);
      }
    }

    console.log(`${foundById} leads resolved by stored ID, ${leadsToResolve.length} need scan/create`);

    // Scan for leads without stored IDs
    if (leadsToResolve.length > 0) {
      console.log(`Scanning Kajabi contacts for ${leadsToResolve.length} lead emails...`);
      const { emailFound, nameFound } = await findContactsByScan(token, siteId, leadsToResolve);

      for (const lead of leadsToResolve) {
        const normEmail = lead.email.trim().toLowerCase();
        const normName = (lead.name || '').trim().toLowerCase();

        let contact = emailFound.get(normEmail) || null;
        if (!contact && nameFound.has(normName)) {
          contact = nameFound.get(normName);
          console.log(`Name match for ${lead.email} → contact_id=${contact.id}, kajabi_email=${contact.email}`);
        }
        if (!contact) {
          try {
            contact = await createContact(token, siteId, lead);
            console.log(`Created: ${lead.email} → contact_id=${contact.id}`);
          } catch (err) {
            if (err.message.startsWith('EMAIL_TAKEN')) {
              console.error(`FAIL  [${lead.email}] — email exists in Kajabi but could not be located`);
              contactMap.set(normEmail, { _failed: true, reason: 'email_taken_unlocatable' });
              continue;
            }
            throw err;
          }
        }
        contactMap.set(normEmail, contact);
      }
    }

    // Apply tags + write back to entity
    const entityUpdates = [];
    const perLead = [];
    let contactsFound = 0, contactsCreated = 0, tagsApplied = 0, tagsRemoved = 0, skipped = 0, failed = 0, subscriptionsSet = 0;

    for (const lead of leads) {
      if (!lead.email) {
        skipped++;
        perLead.push({ lead_name: lead.name, lead_email: null, status: 'skipped', reason: 'no_email' });
        continue;
      }

      const normEmail = lead.email.trim().toLowerCase();
      const contact = contactMap.get(normEmail);
      if (!contact) {
        failed++;
        perLead.push({ lead_name: lead.name, lead_email: lead.email, contact_action: 'failed_unresolved', tag_action: 'skipped' });
        continue;
      }
      if (contact._failed) {
        failed++;
        perLead.push({ lead_name: lead.name, lead_email: lead.email, contact_action: 'failed_email_taken_unlocatable', tag_action: 'skipped' });
        continue;
      }

      const contactAction = contact._created ? 'created' : (lead.kajabi_contact_id === contact.id ? 'found_by_id' : 'found');
      if (contactAction === 'created') contactsCreated++;
      else contactsFound++;

      // Ensure contact is subscribed to marketing emails
      let subscriptionAction = 'already_subscribed';
      if (!contact.subscribed) {
        await subscribeContact(token, contact.id);
        subscriptionAction = 'subscribed';
        subscriptionsSet++;
      }

      // Tag management ("Partner Lead" only)
      const isActive = lead.partner_status !== 'inactive';
      const currentTagIds = await getContactTagIds(token, contact.id);
      const hasTag = currentTagIds.includes(String(tagId));
      let tagAction = 'no_change';

      if (isActive && !hasTag) {
        await addTagToContact(token, contact.id, tagId);
        tagAction = 'tag_added';
        tagsApplied++;
      } else if (!isActive && hasTag) {
        await removeTagFromContact(token, contact.id, tagId);
        tagAction = 'tag_removed';
        tagsRemoved++;
      }

      // Write back to entity (if missing or changed)
      if (contact.id !== lead.kajabi_contact_id) {
        entityUpdates.push({ id: lead.id, kajabi_contact_id: contact.id });
      }

      perLead.push({
        lead_name: lead.name,
        lead_email: lead.email,
        lead_type: lead.lead_type,
        partner_status: lead.partner_status,
        kajabi_contact_id: contact.id,
        kajabi_contact_email: contact.email,
        contact_action: contactAction,
        subscription_action: subscriptionAction,
        tag_action: tagAction,
        is_active: isActive,
      });
      console.log(`OK    [${lead.email}] → contact_id=${contact.id}, action=${contactAction}, tag=${tagAction}`);
    }

    // Bulk update entities
    if (entityUpdates.length > 0) {
      await base44.asServiceRole.entities.Lead.bulkUpdate(entityUpdates);
      console.log(`Bulk updated ${entityUpdates.length} Lead records with kajabi_contact_id`);
    }

    console.log(`Done: found=${contactsFound}, created=${contactsCreated}, found_by_id=${foundById}, tagged=${tagsApplied}, untagged=${tagsRemoved}, subscribed=${subscriptionsSet}, failed=${failed}, skipped=${skipped}`);

    return Response.json({
      success: failed === 0,
      total: leads.length,
      contacts_found: contactsFound,
      contacts_created: contactsCreated,
      found_by_id: foundById,
      tags_applied: tagsApplied,
      subscriptions_set: subscriptionsSet,
      tags_removed: tagsRemoved,
      skipped_no_email: skipped,
      failed_count: failed,
      entity_updates: entityUpdates.length,
      failed: perLead.filter((p) => p.contact_action === 'failed_unresolved' || p.contact_action === 'failed_email_taken_unlocatable'),
      per_lead: perLead,
    });

  } catch (error) {
    console.error('backfillLeadsToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});