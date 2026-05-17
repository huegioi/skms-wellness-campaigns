import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Counts how many fields are populated on a lead record
function countPopulatedFields(data) {
  const fields = ['name', 'email', 'company', 'title', 'phone', 'industry', 'notes',
    'source', 'last_contacted_date', 'next_followup_date', 'referral_potential',
    'outreach_channel', 'email2', 'referral_count', 'last_referral_date'];
  return fields.filter(f => data[f] !== null && data[f] !== undefined && data[f] !== '').length;
}

// Merge two lead records: pick the "winner" (more data + notes), merge referral_history
function mergeLeads(a, b) {
  const scoreA = countPopulatedFields(a) + (a.notes ? 2 : 0) + ((a.referral_history || []).length);
  const scoreB = countPopulatedFields(b) + (b.notes ? 2 : 0) + ((b.referral_history || []).length);

  const [winner, loser] = scoreA >= scoreB ? [a, b] : [b, a];

  // Merge referral_history (deduplicate by date+company_name)
  const combinedHistory = [...(winner.referral_history || []), ...(loser.referral_history || [])];
  const seenHistory = new Set();
  const mergedHistory = combinedHistory.filter(entry => {
    const key = `${entry.date}|${entry.company_name}`;
    if (seenHistory.has(key)) return false;
    seenHistory.add(key);
    return true;
  });

  // Fill in any missing fields from loser into winner
  const merged = { ...winner };
  const fillFields = ['company', 'title', 'phone', 'industry', 'notes', 'source',
    'last_contacted_date', 'next_followup_date', 'referral_potential', 'outreach_channel',
    'email2', 'referral_count', 'last_referral_date'];
  for (const f of fillFields) {
    if ((merged[f] === null || merged[f] === undefined || merged[f] === '') && loser[f]) {
      merged[f] = loser[f];
    }
  }
  merged.referral_history = mergedHistory;
  merged.referral_count = Math.max(winner.referral_count || 0, loser.referral_count || 0, mergedHistory.length);

  return { winner, loser, mergedData: merged };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow scheduled (no auth) or admin user
  let isScheduled = false;
  try {
    const body = await req.clone().json();
    if (body && body.automation) isScheduled = true;
  } catch (_) {}

  if (!isScheduled) {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Fetch all broker_lead type leads
  let allLeads = [];
  let skip = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }, '-created_date', 200, skip);
    if (!batch || batch.length === 0) break;
    allLeads = allLeads.concat(batch);
    if (batch.length < 200) break;
    skip += 200;
  }

  // Group by normalized email
  const emailMap = {};
  for (const lead of allLeads) {
    const email = (lead.email || '').toLowerCase().trim();
    if (!email) continue;
    if (!emailMap[email]) emailMap[email] = [];
    emailMap[email].push(lead);
  }

  let mergedCount = 0;
  let deletedCount = 0;
  const errors = [];

  for (const [email, leads] of Object.entries(emailMap)) {
    if (leads.length < 2) continue;

    // Merge all duplicates into one winner
    let current = leads[0];
    const toDelete = [];

    for (let i = 1; i < leads.length; i++) {
      const { winner, loser, mergedData } = mergeLeads(current, leads[i]);
      // Update the winner with merged data
      await base44.asServiceRole.entities.Lead.update(winner.id, {
        notes: mergedData.notes,
        referral_history: mergedData.referral_history,
        referral_count: mergedData.referral_count,
        company: mergedData.company,
        title: mergedData.title,
        phone: mergedData.phone,
        industry: mergedData.industry,
        source: mergedData.source,
        last_contacted_date: mergedData.last_contacted_date,
        next_followup_date: mergedData.next_followup_date,
        referral_potential: mergedData.referral_potential,
        outreach_channel: mergedData.outreach_channel,
        email2: mergedData.email2,
        last_referral_date: mergedData.last_referral_date,
        partner_status: mergedData.partner_status,
      });
      toDelete.push(loser.id);
      current = { ...winner, ...mergedData, id: winner.id };
      mergedCount++;
    }

    // Delete the losers
    for (const id of toDelete) {
      await base44.asServiceRole.entities.Lead.delete(id);
      deletedCount++;
    }
  }

  console.log(`Dedup complete: ${mergedCount} merges, ${deletedCount} records deleted`);
  return Response.json({ success: true, mergedCount, deletedCount, errors });
});