// @ts-nocheck
/**
 * Everything we know about ONE campaign recipient, as a brief an email writer can use.
 * Used by functions/generateCampaignDraft.
 *
 * Fixes vs. the old mayaContext record text (2026-10-07):
 *   - referral_partner rows load the ReferralPartner (they used to be looked up in Lead
 *     and come back "Record not found"), and Lead ⇄ ReferralPartner ⇄ Client records for
 *     the same email are merged, so notes/meetings stored on either side are seen
 *   - emails: matched ids AND every known address, both directions, NEVER unsent drafts,
 *     with the 500-char body preview instead of a 120-char snippet
 *   - meeting notes (up to 3 summaries) and interaction notes (300 chars, de-duplicated)
 *   - company facts, brokerage, event/source, pipeline stage, next step, meeting outcome
 *   - prior campaign emails to this address, so a draft never opens as first contact
 *     right after another campaign already wrote to them
 */
import { resolveClientContact, listClientContacts, looksLikeOrganization, firstNameOf } from './clientContact.ts';
import { stageLabel, normalizeStage } from './leadStages.ts';

const lower = (s) => String(s || '').trim().toLowerCase();
const day = (d) => {
  // Date-only values ("2026-09-25") are calendar days — never shift them by time zone
  const dateOnly = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const t = new Date(dateOnly ? `${d}T12:00:00Z` : d);
  return isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
};
const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
// Strip the quoted previous message from a reply preview ("On Tue, … wrote:")
const unquote = (s) => String(s || '').split(/\n?On .{5,80}wrote:|\n-{2,} ?Original Message|\nFrom: .+\nSent: /i)[0];

async function safe(p, fallback = []) {
  try { return (await p) ?? fallback; } catch (e) { console.warn('[draftContext]', e?.message); return fallback; }
}
async function byIds(entity, field, ids, sort, limit) {
  const out = [];
  const list = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < list.length; i += 50) {
    out.push(...(await safe(entity.filter({ [field]: { $in: list.slice(i, i + 50) } }, sort, limit))));
  }
  return out;
}

export async function buildRecipientBrief(base44, recipient, { campaignId } = {}) {
  const db = base44.asServiceRole.entities;
  const type = recipient.record_type;
  const email = lower(recipient.email);

  // ── 1. The record itself + the same person/org on the other entities ──
  const [primary] = await safe(
    (type === 'client' ? db.Client : type === 'referral_partner' ? db.ReferralPartner : db.Lead)
      .filter({ id: recipient.record_id }), []);
  const rec = primary || {};
  const addrs = new Set([email, lower(rec.email), lower(rec.email2)].filter(Boolean));

  const leads = type === 'lead' && primary ? [primary] : [];
  const partners = type === 'referral_partner' && primary ? [primary] : [];
  const clients = type === 'client' && primary ? [primary] : [];
  for (const a of [...addrs]) {
    if (type !== 'lead') leads.push(...(await safe(db.Lead.filter({ email: a }, '-created_date', 5))).filter(l => !l.is_archived));
    if (type !== 'referral_partner') partners.push(...await safe(db.ReferralPartner.filter({ email: a }, '-created_date', 5)));
  }
  for (const r of [...leads, ...partners]) for (const e of [r.email, r.email2]) if (e) addrs.add(lower(e));
  const leadIds = [...new Set(leads.map(l => l.id))];
  const partnerIds = [...new Set(partners.map(p => p.id))];
  const clientIds = [...new Set(clients.map(c => c.id))];

  // ── 2. Who we are writing to ──
  let name = '';
  if (type === 'client') {
    const contact = resolveClientContact(rec, email);
    name = contact?.name || '';
  } else {
    name = rec.name || leads[0]?.name || partners[0]?.name || '';
  }
  const company = recipient.company || rec.company || leads[0]?.company || partners[0]?.company || '';
  if (name && (looksLikeOrganization(name, company) || lower(name) === lower(company) || /^(info|hr|team|admin|benefits|office|contact)\b/i.test(name))) name = '';
  const firstName = name ? firstNameOf(name) : null;

  // ── 3. Evidence ──
  const addrList = [...addrs];
  const [emailsById, emailsTo, emailsFrom] = await Promise.all([
    Promise.all([
      byIds(db.EmailLog, 'matched_lead_id', leadIds, '-date', 50),
      byIds(db.EmailLog, 'matched_referral_partner_id', partnerIds, '-date', 50),
      byIds(db.EmailLog, 'matched_client_id', clientIds, '-date', 50),
    ]).then(a => a.flat()),
    byIds(db.EmailLog, 'to_email', addrList, '-date', 50),
    byIds(db.EmailLog, 'from_email', addrList, '-date', 50),
  ]);
  const emailMap = new Map();
  for (const e of [...emailsById, ...emailsTo, ...emailsFrom]) {
    if (e.is_draft || e.is_demo) continue;                 // an unsent draft is not history
    if (type !== 'client' && e.matched_client_id && !addrs.has(lower(e.from_email)) && !addrs.has(lower(e.to_email))) continue;
    emailMap.set(e.id, e);
  }
  const emails = [...emailMap.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const meetingNotes = [
    ...await byIds(db.MeetingNote, 'lead_id', leadIds, '-meeting_date', 10),
    ...await byIds(db.MeetingNote, 'referral_partner_id', partnerIds, '-meeting_date', 10),
    ...await byIds(db.MeetingNote, 'client_id', clientIds, '-meeting_date', 10),
  ].filter((m, i, a) => m.summary && a.findIndex(x => x.id === m.id) === i)
   .sort((a, b) => String(b.meeting_date || b.captured_at).localeCompare(String(a.meeting_date || a.captured_at)));

  const interactionsRaw = [
    ...await byIds(db.ClientInteraction, 'lead_id', leadIds, '-date', 60),
    ...await byIds(db.ClientInteraction, 'referral_partner_id', partnerIds, '-date', 60),
    ...await byIds(db.ClientInteraction, 'client_id', clientIds, '-date', 60),
  ];
  const seen = new Set();
  const interactions = [];
  for (const it of interactionsRaw.sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
    const k = it.calendar_event_id ? `ev:${it.calendar_event_id}` : `${it.id}`;
    if (seen.has(k) || seen.has(it.id)) continue;
    seen.add(k); seen.add(it.id);
    interactions.push(it);
  }

  const events = [
    ...await byIds(db.CalendarEvent, 'lead_id', leadIds, '-start_date', 30),
    ...await byIds(db.CalendarEvent, 'client_id', clientIds, '-start_date', 30),
  ].filter((e, i, a) => a.findIndex(x => x.id === e.id) === i && !e.is_demo);
  const now = Date.now();
  const pastEvents = events.filter(e => new Date(e.start_date).getTime() < now).slice(0, 3);
  const nextEvent = events.filter(e => new Date(e.start_date).getTime() >= now)
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];

  const priorCampaignEmails = (await byIds(db.CampaignRecipient, 'email', addrList, '-sent_at', 30))
    .filter(r => r.campaign_id !== campaignId && ['sent', 'replied'].includes(r.status))
    .sort((a, b) => String(b.sent_at || b.updated_date).localeCompare(String(a.sent_at || a.updated_date)))
    .slice(0, 3);

  const brokerageId = rec.brokerage_id || leads.find(l => l.brokerage_id)?.brokerage_id || partners.find(p => p.brokerage_id)?.brokerage_id;
  const [brokerage] = brokerageId ? await safe(db.Brokerage.filter({ id: brokerageId })) : [];

  // ── 4. The brief ──
  const L = [];
  const lead = leads[0] || {};
  const partner = partners[0] || {};
  L.push('WHO');
  L.push(`- ${name || 'Name unknown'}${(rec.title || lead.title) ? `, ${rec.title || lead.title}` : ''}${company ? ` at ${company}` : ''}`);
  if (type === 'client') {
    const facts = [rec.industry && `industry: ${rec.industry}`, (rec.employee_count || rec.company_size) && `size: ${rec.employee_count || rec.company_size}`,
      rec.company_website && `website: ${rec.company_website}`, rec.client_stage && `stage: ${rec.client_stage.replace(/_/g, ' ')}`].filter(Boolean);
    if (facts.length) L.push(`- Company: ${facts.join(' · ')}`);
    const others = listClientContacts(rec).filter(c => lower(c.email) !== email).slice(0, 4);
    if (others.length) L.push(`- Other contacts there: ${others.map(c => `${c.name || c.email}${c.title ? ` (${c.title})` : ''}`).join('; ')}`);
    if (rec.purchased_services?.length) L.push(`- Has bought: ${rec.purchased_services.join(', ')}`);
    if (rec.broker_name || rec.referral_partner_name) L.push(`- Broker / referred by: ${rec.broker_name || rec.referral_partner_name}`);
  } else {
    L.push(`- Relationship: ${type === 'referral_partner' || partner.id ? 'referral partner (broker)' : 'partner lead (broker)'}${lead.status ? ` · pipeline stage: ${stageLabel(lead.status)}` : ''}${partner.partner_status ? ` · partner status: ${partner.partner_status}` : ''}`);
    if (brokerage?.name || brokerage?.company) L.push(`- Brokerage: ${brokerage.name || brokerage.company}`);
    if (lead.industry) L.push(`- Industry: ${lead.industry}`);
    const src = [lead.source_type, lead.source].filter(Boolean).join(' — ');
    if (src) L.push(`- How we met: ${src}`);
    if ((lead.referral_count || partner.referral_count) > 0) L.push(`- Has referred ${lead.referral_count || partner.referral_count} client(s) to us`);
    if (lead.meeting_outcome) L.push(`- Last meeting outcome: ${lead.meeting_outcome.replace(/_/g, ' ')}`);
    if (lead.next_step) L.push(`- Agreed next step: ${lead.next_step}`);
    if (normalizeStage(lead.status) === 'not_interested' && lead.closed_reason) L.push(`- Parked earlier because: ${lead.closed_reason}`);
  }
  const tags = [...new Set([...(rec.tags || []), ...(lead.tags || []), ...(partner.tags || [])])];
  if (tags.length) L.push(`- Tags (often the event we met at): ${tags.join(', ')}`);

  const notes = [rec.notes, lead.id !== rec.id && lead.notes, partner.id !== rec.id && partner.notes].filter(Boolean).map(n => clip(n, 1200));
  if (notes.length) { L.push('', 'OUR NOTES ON THEM'); for (const n of notes) L.push(`- ${n}`); }

  if (meetingNotes.length) {
    L.push('', 'MEETING NOTES (most recent first)');
    for (const m of meetingNotes.slice(0, 3)) {
      const summary = String(m.summary || '').trim();
      L.push(`- ${day(m.meeting_date || m.captured_at)} "${m.meeting_title || 'Meeting'}":\n${summary.length > 900 ? summary.slice(0, 899) + '…' : summary}`);
    }
  }

  if (emails.length) {
    L.push('', 'EMAIL HISTORY (most recent first; THEY = them, WE = us)');
    for (const e of emails.slice(0, 8)) {
      const who = addrs.has(lower(e.from_email)) ? 'THEY wrote' : 'WE wrote';
      L.push(`- ${day(e.date)} ${who} — "${clip(e.subject, 90)}": ${clip(unquote(e.body_preview || e.snippet), 380)}`);
    }
  }

  if (interactions.length) {
    L.push('', 'LOGGED TOUCHES');
    for (const it of interactions.slice(0, 8)) {
      const bits = [it.channel || it.interaction_type, clip(it.subject, 80), clip(it.notes, 300), it.outcome && `outcome: ${it.outcome}`].filter(Boolean);
      L.push(`- ${day(it.date)} ${bits.join(' — ')}`);
    }
  }

  if (pastEvents.length || nextEvent) {
    L.push('', 'MEETINGS ON THE CALENDAR');
    for (const e of pastEvents) L.push(`- ${day(e.start_date)} (past) ${clip(e.title, 90)}`);
    if (nextEvent) L.push(`- ${day(nextEvent.start_date)} (UPCOMING) ${clip(nextEvent.title, 90)}`);
  }

  if (priorCampaignEmails.length) {
    L.push('', 'OTHER CAMPAIGN EMAILS ALREADY SENT TO THEM');
    for (const r of priorCampaignEmails) L.push(`- ${day(r.sent_at || r.updated_date)} "${clip(r.draft_subject, 90)}" (${r.status})`);
  }

  const counts = {
    notes: notes.length, meeting_notes: meetingNotes.length, emails: emails.length,
    their_emails: emails.filter(e => addrs.has(lower(e.from_email))).length,
    interactions: interactions.length, past_meetings: pastEvents.length,
  };
  const rich = counts.notes + counts.meeting_notes + counts.emails + counts.interactions + counts.past_meetings > 0
    || !!lead.next_step || tags.length > 0;

  return {
    text: L.join('\n'),
    name, firstName, company,
    rich,
    counts,
    lastTheyWrote: emails.find(e => addrs.has(lower(e.from_email))) || null,
    addresses: addrList,
  };
}
