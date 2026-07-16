import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const REFERRAL_PARTNERS_TAG_NAME = 'Referral Partner';
const PARTNER_LEAD_TAG_NAME = 'Partner Lead';
const PAGE_SIZE = 500;
const MAX_SCAN_PAGES = 20;

// Sheet config (reused from syncBrokerLeadsSheet)
const SPREADSHEET_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';
const KNOWN_TABS = ['Referral Partners', 'Broker Leads', 'Brokers'];

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

async function resolveTagIds(token, siteId) {
  const targetNames = [REFERRAL_PARTNERS_TAG_NAME, PARTNER_LEAD_TAG_NAME];
  const resolved = {};
  let page = 1;
  while (Object.keys(resolved).length < targetNames.length) {
    const res = await fetch(`${KAJABI_API_URL}/contact_tags?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`, { headers: apiHeaders(token) });
    if (!res.ok) throw new Error(`Failed to list contact_tags (${res.status})`);
    const body = await res.json();
    const tags = body.data || [];
    for (const t of tags) {
      const name = (t.attributes?.name || '').toLowerCase();
      for (const target of targetNames) {
        if (name === target.toLowerCase() && !resolved[target]) {
          resolved[target] = t.id;
          console.log(`Tag "${target}" found: id=${t.id}`);
        }
      }
    }
    if (!body.links?.next || tags.length === 0) break;
    page++;
  }
  const missing = targetNames.filter((n) => !resolved[n]);
  if (missing.length > 0) {
    throw new Error(`Tag(s) "${missing.join('", "')}" not found in Kajabi. Please create them manually first.`);
  }
  return { referralPartnerTagId: resolved[REFERRAL_PARTNERS_TAG_NAME], partnerLeadTagId: resolved[PARTNER_LEAD_TAG_NAME] };
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

async function findContactsByScan(token, siteId, partnersToResolve) {
  const emailFound = new Map();
  const nameFound = new Map();
  const emailsLooking = new Set();
  const namesLooking = new Map();
  for (const partner of partnersToResolve) {
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
        nameFound.set(name, { id: c.id, email: c.attributes?.email, name: c.attributes?.name, _created: false });
        remaining--;
        foundThisPage++;
      }
    }
    console.log(`Scan page ${page}: ${contacts.length} contacts — found ${foundThisPage} this page, ${emailFound.size + nameFound.size} total, ${remaining} remaining`);
    if (!body.links?.next) break;
    page++;
  }

  if (remaining > 0) {
    console.log(`Scan stopped at page ${page - 1} (${remaining} partners still unmatched)`);
  }
  return { emailFound, nameFound };
}

async function createContact(token, siteId, partner) {
  const attributes = { name: partner.name, email: partner.email, subscribed: true };
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

async function removeTagFromContact(token, contactId, tagId) {
  const res = await fetch(`${KAJABI_API_URL}/contacts/${contactId}/relationships/tags`, {
    method: 'DELETE',
    headers: apiHeaders(token),
    body: JSON.stringify({ data: [{ type: 'contact_tags', id: String(tagId) }] }),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to remove tag from contact ${contactId} (${res.status})`);
}

// ── Sheet write-back ──────────────────────────────────────────────────────────

async function loadSheetInfo(base44) {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const meta = await metaRes.json();
    const tabs = meta.sheets?.map(s => s.properties?.title) || [];
    const sheetName = KNOWN_TABS.find(t => tabs.includes(t)) || tabs[0];
    if (!sheetName) return null;

    const headerRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!1:1')}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const headerData = await headerRes.json();
    const headerRow = headerData.values?.[0] || [];
    const lowerHeaders = headerRow.map(h => h.toLowerCase().trim());

    const emailColIdx = lowerHeaders.findIndex(h => h === 'email' || h === 'email address');
    const kajabiColIdx = lowerHeaders.findIndex(h => h === 'kajabi contact id' || h === 'kajabi_contact_id');
    if (emailColIdx === -1 || kajabiColIdx === -1) return null;

    // Read all data to build email → row map + current kajabi values
    const dataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!A:Z')}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const dataJson = await dataRes.json();
    const allRows = dataJson.values || [];

    const emailToRow = {};
    const existingKajabiValues = {};
    for (let i = 1; i < allRows.length; i++) {
      const email = (allRows[i][emailColIdx] || '').trim().toLowerCase();
      if (email) {
        emailToRow[email] = i + 1;
        existingKajabiValues[email] = (allRows[i][kajabiColIdx] || '').trim();
      }
    }

    return { accessToken, sheetName, kajabiColIdx, emailToRow, existingKajabiValues };
  } catch (err) {
    console.warn(`Sheet info load failed: ${err.message}`);
    return null;
  }
}

async function writeKajabiContactIdCell(sheetInfo, email, kajabiContactId) {
  const normEmail = email.trim().toLowerCase();
  const row = sheetInfo.emailToRow[normEmail];
  if (!row) return { success: false, reason: 'row_not_found' };

  // Skip if already matches (idempotent)
  if (sheetInfo.existingKajabiValues[normEmail] === String(kajabiContactId)) {
    return { success: true, reason: 'already_set' };
  }

  const colLetter = String.fromCharCode(65 + sheetInfo.kajabiColIdx);
  const cellRange = `${sheetInfo.sheetName}!${colLetter}${row}`;
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${sheetInfo.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: cellRange, majorDimension: 'ROWS', values: [[String(kajabiContactId)]] }),
  });
  const updateData = await updateRes.json();
  if (updateData.error) return { success: false, reason: updateData.error.message };

  // Update local cache
  sheetInfo.existingKajabiValues[normEmail] = String(kajabiContactId);
  return { success: true, cellRange };
}

// ── Main handler ──────────────────────────────────────────────────────────────


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const siteId = Deno.env.get('KAJABI_SITE_ID');
    const token = await getAccessToken();
    const tagIds = await resolveTagIds(token, siteId);

    const allPartnersRaw = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 1000);
    const partners = allPartnersRaw.filter(p => !p.is_demo);
    console.log(`Found ${allPartnersRaw.length} referral partners to sync — ${allPartnersRaw.length - partners.length} demo record(s) excluded`);

    // Load sheet email→row map once for batch write-back
    const sheetInfo = await loadSheetInfo(base44);
    if (sheetInfo) console.log(`Sheet map loaded: ${Object.keys(sheetInfo.emailToRow).length} rows, Kajabi column index: ${sheetInfo.kajabiColIdx}`);
    else console.log('Sheet map not available — skipping sheet write-back');

    // Separate partners: those with stored kajabi_contact_id vs those without
    const partnersToResolve = [];
    const contactMap = new Map(); // lowercase email -> { id, email, name, _created }
    let foundById = 0;

    for (const partner of partners) {
      if (!partner.email) continue;
      const normEmail = partner.email.trim().toLowerCase();

      if (partner.kajabi_contact_id) {
        // Use GET directly — skip the scan
        const contact = await getContactById(token, partner.kajabi_contact_id);
        if (contact) {
          contactMap.set(normEmail, { id: contact.id, email: contact.attributes?.email, name: contact.attributes?.name, _created: false });
          foundById++;
          console.log(`GET by stored ID: ${partner.email} → contact_id=${contact.id}`);
        } else {
          console.log(`Stored kajabi_contact_id ${partner.kajabi_contact_id} for ${partner.email} returned 404 — will resolve via scan`);
          partnersToResolve.push(partner);
        }
      } else {
        partnersToResolve.push(partner);
      }
    }

    console.log(`${foundById} partners resolved by stored ID, ${partnersToResolve.length} need scan/create`);

    // Scan for partners without stored IDs
    if (partnersToResolve.length > 0) {
      console.log(`Scanning Kajabi contacts for ${partnersToResolve.length} partner emails...`);
      const { emailFound, nameFound } = await findContactsByScan(token, siteId, partnersToResolve);

      for (const partner of partnersToResolve) {
        const normEmail = partner.email.trim().toLowerCase();
        const normName = (partner.name || '').trim().toLowerCase();

        let contact = emailFound.get(normEmail) || null;
        if (!contact && nameFound.has(normName)) {
          contact = nameFound.get(normName);
          console.log(`Name match for ${partner.email} → contact_id=${contact.id}, kajabi_email=${contact.email}`);
        }
        if (!contact) {
          try {
            contact = await createContact(token, siteId, partner);
            console.log(`Created: ${partner.email} → contact_id=${contact.id}`);
          } catch (err) {
            if (err.message.startsWith('EMAIL_TAKEN')) {
              console.error(`FAIL  [${partner.email}] — email exists in Kajabi but could not be located`);
              contactMap.set(normEmail, { _failed: true, reason: 'email_taken_unlocatable' });
              continue;
            }
            throw err;
          }
        }
        contactMap.set(normEmail, contact);
      }
    }

    // Apply tags + write back to entity + sheet
    const entityUpdates = [];
    const perPartner = [];
    let contactsFound = 0, contactsCreated = 0, tagsApplied = 0, tagsRemoved = 0, skipped = 0, failed = 0, sheetWrites = 0;

    for (const partner of partners) {
      if (!partner.email) {
        skipped++;
        perPartner.push({ partner_name: partner.name, partner_email: null, status: 'skipped', reason: 'no_email' });
        continue;
      }

      const normEmail = partner.email.trim().toLowerCase();
      const contact = contactMap.get(normEmail);
      if (!contact) {
        failed++;
        perPartner.push({ partner_name: partner.name, partner_email: partner.email, contact_action: 'failed_unresolved', tag_action: 'skipped' });
        continue;
      }
      if (contact._failed) {
        failed++;
        perPartner.push({ partner_name: partner.name, partner_email: partner.email, contact_action: 'failed_email_taken_unlocatable', tag_action: 'skipped' });
        continue;
      }

      const contactAction = contact._created ? 'created' : (partner.kajabi_contact_id === contact.id ? 'found_by_id' : 'found');
      if (contactAction === 'created') contactsCreated++;
      else contactsFound++;

      // Tag management (both "Referral Partner" and "Partner Lead")
      const isActive = partner.is_active === true && partner.partner_status !== 'Inactive';
      const currentTagIds = await getContactTagIds(token, contact.id);
      const tagActionMap = {};

      for (const [tagName, tagId] of [
        [REFERRAL_PARTNERS_TAG_NAME, tagIds.referralPartnerTagId],
        [PARTNER_LEAD_TAG_NAME, tagIds.partnerLeadTagId],
      ]) {
        if (!tagId) {
          tagActionMap[tagName] = 'not_resolved';
          continue;
        }
        const hasTag = currentTagIds.includes(String(tagId));
        if (isActive && !hasTag) {
          await addTagToContact(token, contact.id, tagId);
          tagActionMap[tagName] = 'tag_added';
          tagsApplied++;
        } else if (!isActive && hasTag) {
          await removeTagFromContact(token, contact.id, tagId);
          tagActionMap[tagName] = 'tag_removed';
          tagsRemoved++;
        } else {
          tagActionMap[tagName] = 'no_change';
        }
      }

      // Write back to entity (if missing or changed)
      if (contact.id !== partner.kajabi_contact_id) {
        entityUpdates.push({ id: partner.id, kajabi_contact_id: contact.id });
      }

      // Write back to sheet (if missing or changed)
      if (sheetInfo) {
        const sheetResult = await writeKajabiContactIdCell(sheetInfo, partner.email, contact.id);
        if (sheetResult.success && sheetResult.reason !== 'already_set') sheetWrites++;
      }

      perPartner.push({
        partner_name: partner.name,
        partner_email: partner.email,
        kajabi_contact_id: contact.id,
        kajabi_contact_email: contact.email,
        contact_action: contactAction,
        tag_actions: tagActionMap,
      });
      console.log(`OK    [${partner.email}] → contact_id=${contact.id}, action=${contactAction}, tags=${JSON.stringify(tagActionMap)}`);
    }

    // Bulk update entities
    if (entityUpdates.length > 0) {
      await base44.asServiceRole.entities.ReferralPartner.bulkUpdate(entityUpdates);
      console.log(`Bulk updated ${entityUpdates.length} ReferralPartner records with kajabi_contact_id`);
    }

    console.log(`Done: found=${contactsFound}, created=${contactsCreated}, found_by_id=${foundById}, tagged=${tagsApplied}, untagged=${tagsRemoved}, failed=${failed}, skipped=${skipped}, sheet_writes=${sheetWrites}`);

    return Response.json({
      success: failed === 0,
      total: partners.length,
      contacts_found: contactsFound,
      contacts_created: contactsCreated,
      found_by_id: foundById,
      tags_applied: tagsApplied,
      tags_removed: tagsRemoved,
      skipped_no_email: skipped,
      failed_count: failed,
      sheet_writes: sheetWrites,
      entity_updates: entityUpdates.length,
      failed: perPartner.filter((p) => p.contact_action === 'failed_unresolved' || p.contact_action === 'failed_email_taken_unlocatable'),
      per_partner: perPartner,
    });

  } catch (error) {
    console.error('backfillReferralPartnersToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});