import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { upsertClientLead } from '../../shared/warmProspect.ts';

/**
 * Signed-in only — the Dashboard Review Queue's actions on a conference scan.
 *
 *   add_client  → Client Lead via upsertClientLead (the warm pipeline's ONE
 *                 writer; matches by email domain, never creates a company for
 *                 a free-mail address)
 *   add_partner → Partner Lead: ReferralPartner, partner_status 'Prospect',
 *                 matched by email so a known partner is never duplicated,
 *                 PLUS a card on the Partners → Referral Partners board
 *                 (a broker_lead Lead) — that board is where William works
 *                 partners. He approved this exception 2026-09-30: the
 *                 'legacy Lead is frozen' rule stays for the automated
 *                 warming tools; scans he files by hand go on the board.
 *   dismiss     → marked dismissed, nothing filed
 *
 * Notes and tags typed on the Review Queue card (2026-10-01) travel with the
 * person: tags are MERGED into the record's tags (never replace existing
 * ones), notes go on the timeline entry and onto new records. Existing
 * records' own notes field is never overwritten. The scan's LinkedIn link
 * (findScanLinkedIn, or pasted on the card) fills linkedin_url where empty.
 *
 * Never emails the contact — outreach stays by hand.
 */

const cleanTags = (t: unknown): string[] =>
  Array.isArray(t) ? [...new Set(t.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 30) : [];
const mergeTags = (a: unknown, b: string[]) => [...new Set([...(Array.isArray(a) ? a : []), ...b])];
const ownerFor = (email: string) => (String(email || '').toLowerCase().startsWith('heather') ? 'Heather' : 'William');

/**
 * Timeline entry on the Client / Partner record. Uses values that pass
 * ClientInteraction's enums (interaction_type 'note', channel 'other').
 */
async function logScanTouch(
  base44: any, target: { client_id?: string; referral_partner_id?: string },
  scan: any, reviewer: string, notes: string, tags: string[],
) {
  try {
    const lines = [
      `${scan.name || 'Visitor'}${scan.company ? ` (${scan.company})` : ''} <${scan.email}> scanned the ${scan.source_label || scan.source_key} code and left their details. Filed from the Review Queue by ${reviewer}.`,
      tags.length ? `Tags: ${tags.join(', ')}` : '',
      scan.linkedin_url ? `LinkedIn: ${scan.linkedin_url}` : '',
      notes ? `Notes: ${notes}` : '',
    ].filter(Boolean);
    await base44.asServiceRole.entities.ClientInteraction.create({
      ...target,
      interaction_type: 'note',
      channel: 'other',
      date: scan.created_date || new Date().toISOString(),
      subject: `Conference QR scan — ${scan.source_label || scan.source_key}`,
      notes: lines.join('\n'),
      owner: ownerFor(reviewer),
    });
  } catch (err) {
    console.error('[reviewScanLead] timeline write failed:', (err as any)?.message || err);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { scan_id, action, review_notes } = body;
  if (!scan_id || !['add_client', 'add_partner', 'dismiss'].includes(action)) {
    return Response.json({ error: 'scan_id and a valid action are required' }, { status: 400 });
  }

  const scan = (await base44.asServiceRole.entities.ScanLead.filter({ id: scan_id }))?.[0];
  if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });
  if (scan.status !== 'pending_review') {
    return Response.json({ error: 'This scan has already been reviewed' }, { status: 409 });
  }

  // The card sends its current notes/tags with the click, so nothing typed in
  // the last second is lost; fall back to what's saved on the scan.
  const notes = String(body.notes ?? scan.notes ?? '').trim().slice(0, 4000);
  const tags = cleanTags(body.tags ?? scan.tags);

  const reviewed = {
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.email,
    notes: notes || undefined,
    tags,
    ...(review_notes ? { review_notes: String(review_notes).slice(0, 1000) } : {}),
  };
  const sourceText = `conference QR scan (${scan.source_label || scan.source_key})`;

  if (action === 'dismiss') {
    await base44.asServiceRole.entities.ScanLead.update(scan.id, { status: 'dismissed', ...reviewed });
    return Response.json({ ok: true, status: 'dismissed' });
  }

  if (action === 'add_client') {
    const res = await upsertClientLead(base44, {
      email: scan.email,
      contact_name: scan.name || null,
      company_name: scan.company || null,
      source: sourceText,
    });
    if (!res.client_id) {
      // Save what was typed so it isn't lost, but leave the scan pending.
      await base44.asServiceRole.entities.ScanLead.update(scan.id, { notes: notes || undefined, tags });
      return Response.json({
        error: 'This looks like a personal email, so there is no company to file it under. Add them as a Partner Lead, or dismiss and follow up by hand.',
        debug: res.debug,
      }, { status: 422 });
    }
    // A new Client Lead takes this person's LinkedIn; an existing company
    // keeps its own (the link still goes on the timeline entry).
    const linkedinForNew = !res.existing && scan.linkedin_url ? scan.linkedin_url : '';
    if (tags.length || linkedinForNew) {
      try {
        const client = (await base44.asServiceRole.entities.Client.filter({ id: res.client_id }))?.[0];
        const patch: Record<string, unknown> = {};
        if (tags.length) patch.tags = mergeTags(client?.tags, tags);
        if (linkedinForNew && !client?.linkedin_url) patch.linkedin_url = linkedinForNew;
        if (Object.keys(patch).length) await base44.asServiceRole.entities.Client.update(res.client_id, patch);
      } catch (err) {
        console.error('[reviewScanLead] client tags failed:', (err as any)?.message || err);
      }
    }
    await logScanTouch(base44, { client_id: res.client_id }, scan, user.email, notes, tags);
    await base44.asServiceRole.entities.ScanLead.update(scan.id, {
      status: 'added_client_lead', client_id: res.client_id, ...reviewed,
    });
    return Response.json({
      ok: true, status: 'added_client_lead', client_id: res.client_id,
      existing: res.existing, is_current_client: res.is_current_client, company_name: res.company_name,
    });
  }

  // add_partner
  const emailLower = String(scan.email).toLowerCase();
  const matches = await base44.asServiceRole.entities.ReferralPartner.filter({ email: emailLower }, '-created_date', 1);
  let partner = matches?.[0] || null;
  let existing = true;
  if (!partner) {
    existing = false;
    partner = await base44.asServiceRole.entities.ReferralPartner.create({
      name: scan.name || emailLower,
      email: emailLower,
      ...(scan.company ? { company: scan.company } : {}),
      partner_status: 'Prospect',
      is_active: false,
      unique_portal_id: crypto.randomUUID(),
      ...(scan.linkedin_url ? { linkedin_url: scan.linkedin_url } : {}),
      tags,
      notes: [
        `Partner Lead — first seen via ${sourceText} on ${new Date().toISOString().slice(0, 10)}.`,
        notes,
      ].filter(Boolean).join('\n\n'),
    });
  } else if (tags.length || (scan.linkedin_url && !partner.linkedin_url)) {
    try {
      await base44.asServiceRole.entities.ReferralPartner.update(partner.id, {
        tags: mergeTags(partner.tags, tags),
        ...(scan.linkedin_url && !partner.linkedin_url ? { linkedin_url: scan.linkedin_url } : {}),
      });
    } catch (err) {
      console.error('[reviewScanLead] partner tags failed:', (err as any)?.message || err);
    }
  }
  await logScanTouch(base44, { referral_partner_id: partner.id }, scan, user.email, notes, tags);
  const leadId = await ensureBoardCard(base44, scan, emailLower, user, notes, tags);
  await base44.asServiceRole.entities.ScanLead.update(scan.id, {
    status: 'added_partner_lead', referral_partner_id: partner.id, ...reviewed,
  });
  return Response.json({
    ok: true, status: 'added_partner_lead', referral_partner_id: partner.id, lead_id: leadId, existing,
  });
});

/**
 * Card on Partners → Referral Partners (a broker_lead Lead). Re-uses an
 * existing card for the same email (un-archiving it, merging tags) instead of
 * duplicating. Met in person at the booth, so it starts as 'contacted' with a
 * follow-up two days out — the same defaults as adding a partner by hand.
 */
async function ensureBoardCard(
  base44: any, scan: any, emailLower: string, user: any, notes: string, tags: string[],
): Promise<string | null> {
  try {
    const existing = (await base44.asServiceRole.entities.Lead.filter({ email: emailLower }, '-created_date', 1))?.[0];
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (existing.is_archived) patch.is_archived = false;
      if (existing.lead_type !== 'broker_lead') patch.lead_type = 'broker_lead';
      if (!existing.company && scan.company) patch.company = scan.company;
      if (!existing.linkedin_url && scan.linkedin_url) patch.linkedin_url = scan.linkedin_url;
      if (tags.length) patch.tags = mergeTags(existing.tags, tags);
      if (Object.keys(patch).length) await base44.asServiceRole.entities.Lead.update(existing.id, patch);
      return existing.id;
    }
    const today = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const followUp = new Date(today.getTime() + 2 * 86400000);
    const created = await base44.asServiceRole.entities.Lead.create({
      name: scan.name || emailLower,
      email: emailLower,
      company: scan.company || undefined,
      lead_type: 'broker_lead',
      partner_status: 'new',
      status: 'contacted',
      referral_potential: 'medium',
      owner: ownerFor(user.email),
      source: `Conference QR — ${scan.source_label || scan.source_key}`,
      ...(scan.linkedin_url ? { linkedin_url: scan.linkedin_url } : {}),
      last_contacted_date: ymd(new Date(scan.created_date || today)),
      next_followup_date: ymd(followUp),
      tags,
      notes: [
        `Met at a conference — scanned the ${scan.source_label || scan.source_key} code and left their details.`,
        notes,
      ].filter(Boolean).join('\n\n'),
    });
    return created.id;
  } catch (err) {
    console.error('[reviewScanLead] board card failed:', (err as any)?.message || err);
    return null;
  }
}
