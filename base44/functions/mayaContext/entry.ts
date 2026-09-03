import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveClientContact, listClientContacts } from '../../shared/clientContact.ts';

// ═══════════════════════════════════════════════════════════════════════════
// Maya Context Builder — shared backend function invoked by:
//   mayaContextualInsights, mayaDraftEmail, mayaDailyBriefing
//
// Usage: base44.functions.invoke('mayaContext', { action, record_type, record_id })
//   action='record' → { contextText, recipientEmail, recipientName, owner }
//   action='global' → { contextText, data, stats }
//
// Every context block is prefixed with a "DATA GAPS" header listing what was
// unavailable so Maya doesn't hallucinate around missing data.
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared Maya persona (returned via action='persona') ────────────────────
const MAYA_PERSONA = `You are Maya, SkillfulMeans' operations and sales intelligence. SkillfulMeans sells preventative mental fitness campaigns (workshops + 14-day challenges + leadership EQ + wellness boxes) to employers, positioning against absenteeism, presenteeism, turnover, and medical claims. Sales philosophy: consultative and evidence-led — recommend full campaigns over one-off events, tie every suggestion to ROI and the client's stated goals, respect the stage playbook cadence without being pushy. Most revenue is repeat purchase: delivery excellence and demonstrated ROI drive renewals; treat renewal-season (Jan 1 / July 1 cohorts) preparation as a first-class concern. You report to William and Heather. Voice: warm, direct, specific.

Rules: ground every suggestion in the provided context and name the evidence ('proposal viewed twice, no touch in 9 days'). If context is missing, say what you'd need rather than guessing. Never invent services, prices, or history. Draft communications for humans to send — never imply you sent anything. Keep suggestions to the 2–3 highest-leverage actions.

FORMATTING RULES:
- For how-do-I / process questions: give a short numbered list of steps. When a process has 3+ steps, ALSO include a mermaid flowchart in a \`\`\`mermaid fenced code block (use flowchart TD syntax, one node per step, arrows showing sequence). Keep it simple — no branching unless the process actually branches.
- For data questions (comparisons, lists of clients/partners, metrics): use compact markdown tables instead of paragraphs.
- When a knowledge entry used for your answer contains image markdown like ![alt](url), include the relevant image in your response so the user can see the screenshot inline.
- Use **bold** for key names and numbers. Use ## headings to separate sections in longer answers.`;

// ── Pricing rules (appended to the global service catalog) ──────────────────
const PRICING_RULES = `PRICING RULES:
Challenge pricing is volume-tiered: ≤150 employees ≈ 40 slots @ $27 ≈ $1,080 per challenge; ~300 employees ≈ 60 @ $24; larger orgs get lower per-person rates. Wellness boxes: physical ~$100/box, digital $30 + gift-card value. These are estimate rates — final pricing is always set in William's proposal; quote as 'typically' or 'from', never as binding.`;

// ── Renewal logic (ported from src/lib/renewal.js — keep in sync) ──────────

const RAMP_DAYS = 90;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

function nextCohortDate(now, monthIndex, day) {
  const year = now.getFullYear();
  let d = new Date(year, monthIndex, day);
  if (d < now) d = new Date(year + 1, monthIndex, day);
  return d;
}

function nextAnniversary(now, baseStr) {
  if (!baseStr) return null;
  const base = new Date(baseStr);
  if (isNaN(base.getTime())) return null;
  const year = now.getFullYear();
  let d = new Date(year, base.getMonth(), base.getDate());
  if (isNaN(d.getTime())) d = new Date(year, base.getMonth(), 15);
  if (d < now) {
    d = new Date(year + 1, base.getMonth(), base.getDate());
    if (isNaN(d.getTime())) d = new Date(year + 1, base.getMonth(), 15);
  }
  return d;
}

function getEffectiveRenewalDate(record, now) {
  if (!record) return null;
  now = now || new Date();
  const cohort = record.renewal_cohort;
  if (cohort === 'Jan 1') return nextCohortDate(now, 0, 1);
  if (cohort === 'July 1') return nextCohortDate(now, 6, 1);
  if (record.renewal_date) {
    const d = new Date(record.renewal_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (record.plan_year_start) return nextAnniversary(now, record.plan_year_start);
  return null;
}

function daysUntilRenewal(record, now) {
  now = now || new Date();
  const d = getEffectiveRenewalDate(record, now);
  if (!d) return null;
  const days = daysBetween(now, d);
  return days < 0 ? null : days;
}

function getActiveCohort(now, rampDays) {
  now = now || new Date();
  rampDays = rampDays || RAMP_DAYS;
  const jan1 = nextCohortDate(now, 0, 1);
  const jul1 = nextCohortDate(now, 6, 1);
  const dJan = daysBetween(now, jan1);
  const dJul = daysBetween(now, jul1);
  if (dJan >= 0 && dJan <= rampDays) return { label: 'Jan 1', date: jan1, daysRemaining: dJan };
  if (dJul >= 0 && dJul <= rampDays) return { label: 'July 1', date: jul1, daysRemaining: dJul };
  return null;
}

// ── Delivery snapshot (ported from src/hooks/useClientDeliveryStatus.js) ───

function computeDeliverySnapshot(client, proposals, events, services, cohortAssessments, feedback) {
  const acceptedProposals = proposals.filter(p => p.client_id === client.id && p.status === 'accepted');
  const acceptedProposalIds = new Set(acceptedProposals.map(p => p.id));

  const selectedServiceIds = new Set();
  for (const proposal of acceptedProposals) {
    const sel = proposal.selections || {};
    [
      ...(sel.workshops || []),
      ...(sel.challengePrograms || []),
      ...(sel.leadership || []),
      ...(sel.movementClasses || []),
    ].forEach(id => { if (id) selectedServiceIds.add(id); });
  }

  const serviceMeta = {};
  for (const s of services) {
    if (selectedServiceIds.has(s.id)) serviceMeta[s.id] = { name: s.name || s.id, category: s.category || 'other' };
  }
  for (const proposal of acceptedProposals) {
    const sel = proposal.selections || {};
    const enrichMap = [['workshopsData', 'workshop'], ['challengeProgramsData', 'challenge'], ['leadershipData', 'leadership'], ['movementClassesData', 'class']];
    for (const [key, cat] of enrichMap) {
      for (const svc of (sel[key] || [])) {
        if (svc.id && selectedServiceIds.has(svc.id) && !serviceMeta[svc.id]) {
          serviceMeta[svc.id] = { name: svc.name || svc.id, category: cat };
        }
      }
    }
  }

  const challengeServiceIds = new Set();
  for (const s of services) {
    if (s.category === 'challenge' && selectedServiceIds.has(s.id)) challengeServiceIds.add(s.id);
  }
  for (const proposal of acceptedProposals) {
    (proposal.selections?.challengePrograms || []).forEach(id => challengeServiceIds.add(id));
  }

  const totalServices = selectedServiceIds.size;

  const clientEvents = events.filter(e =>
    e.client_id === client.id || (e.proposal_id && acceptedProposalIds.has(e.proposal_id))
  );

  const deliveredServiceIds = new Set();
  const scheduledServiceIds = new Set();
  for (const e of clientEvents) {
    if (e.service_id && selectedServiceIds.has(e.service_id)) {
      scheduledServiceIds.add(e.service_id);
      if (e.completed) deliveredServiceIds.add(e.service_id);
    }
  }
  const unscheduledCount = totalServices - scheduledServiceIds.size;

  const unscheduledServices = [];
  for (const id of selectedServiceIds) {
    if (!scheduledServiceIds.has(id)) {
      const meta = serviceMeta[id] || { name: id, category: 'other' };
      unscheduledServices.push({ id, name: meta.name, category: meta.category });
    }
  }

  const now = new Date();
  const upcoming = clientEvents
    .filter(e => new Date(e.start_date) >= now)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  const nextEvent = upcoming[0] || null;

  let presenterStatus = 'none';
  if (nextEvent) {
    if (nextEvent.presenter_accepted === true) presenterStatus = 'accepted';
    else if (nextEvent.presenter_id) presenterStatus = 'assigned';
    else presenterStatus = 'unassigned';
  }

  let challengeAssessment = null;
  if (challengeServiceIds.size > 0) {
    let d0 = false, d14 = false;
    for (const a of cohortAssessments) {
      if (a.client_id !== client.id) continue;
      if (!challengeServiceIds.has(a.service_id)) continue;
      if (a.survey_type === 'challenge_day0') d0 = true;
      if (a.survey_type === 'challenge_day14') d14 = true;
    }
    challengeAssessment = { d0, d14 };
  }

  let feedbackCount = 0;
  for (const f of feedback) {
    if (f.client_id === client.id) feedbackCount++;
  }

  return {
    totalServices,
    deliveredCount: deliveredServiceIds.size,
    scheduledCount: scheduledServiceIds.size,
    nextEvent,
    unscheduledCount,
    unscheduledServices,
    presenterStatus,
    challengeAssessment,
    feedbackCount,
    hasAcceptedProposals: acceptedProposals.length > 0,
  };
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function daysSince(d) {
  return d ? Math.round((Date.now() - new Date(d)) / 86400000) : null;
}

function fmtDate(d) {
  if (!d) return 'Unknown';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return 'Unknown';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtMoney(n) {
  return `$${(n || 0).toLocaleString()}`;
}

// ── MFS instrument normalization (0–100, higher = better) ──────────────────
function normalizeInstrumentScore(instrumentKey, responses) {
  if (!responses) return null;
  const q1 = responses.q1 || 0;
  const q2 = responses.q2 || 0;
  const q3 = responses.q3 || 0;
  const q4 = responses.q4 || 0;
  const q5 = responses.q5 || 0;
  switch (instrumentKey) {
    case 'who5':  return (q1 + q2 + q3 + q4 + q5) * 4;
    case 'pss4':  return ((16 - (q1 + q2 + q3 + q4)) / 16) * 100;
    case 'uwes3': return (((q1 + q2 + q3) / 3) / 6) * 100;
    case 'ucla3': return ((9 - (q1 + q2 + q3)) / 6) * 100;
    default: return null;
  }
}

// ── Safe fetch helpers (never throw — return [] on failure) ────────────────

async function safeFilter(base44, entityName, query, sort, limit) {
  try {
    return await base44.asServiceRole.entities[entityName].filter(query, sort, limit);
  } catch (e) {
    console.log(`[mayaContext] Failed to filter ${entityName}:`, e.message);
    return [];
  }
}

async function safeList(base44, entityName, sort, limit) {
  try {
    return await base44.asServiceRole.entities[entityName].list(sort, limit);
  } catch (e) {
    console.log(`[mayaContext] Failed to list ${entityName}:`, e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD RECORD CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

async function buildRecordContext(base44, record_type, record_id) {
  // Normalize 'referral_partner' → 'partner' (internal alias used by Outreach Campaigns)
  if (record_type === 'referral_partner') record_type = 'partner';
  const now = new Date();
  const gaps = [];
  const sections = [];
  let recipientEmail = '';
  let recipientName = '';
  let owner = '';

  let record = null;
  let partner = null;
  let referrals = [];

  if (record_type === 'client') {
    const clients = await safeFilter(base44, 'Client', { id: record_id });
    record = clients[0];
    if (!record) return { contextText: 'Client not found', recipientEmail: '', recipientName: '', owner: '' };
    recipientEmail = record.email || '';
    // `Client.name` is the primary CONTACT field, but on many records it holds
    // the organization instead. Resolve the human who owns this address; empty
    // when there is none, so callers greet neutrally rather than guessing.
    recipientName = resolveClientContact(record).name || '';
    owner = record.owner || 'William';
  } else if (record_type === 'partner' || record_type === 'lead') {
    const leads = await safeFilter(base44, 'Lead', { id: record_id });
    record = leads[0];
    if (!record) return { contextText: 'Record not found', recipientEmail: '', recipientName: '', owner: '' };
    recipientEmail = record.email || '';
    recipientName = record.name || '';
    owner = record.owner || 'William';

    if (record_type === 'partner') {
      const allPartners = await safeList(base44, 'ReferralPartner');
      partner = allPartners.find(p =>
        p.email?.toLowerCase() === record.email?.toLowerCase() ||
        p.name?.toLowerCase() === record.name?.toLowerCase()
      );
      if (partner) {
        referrals = await safeFilter(base44, 'Referral', { referral_partner_id: partner.id });
      } else {
        gaps.push('No matching ReferralPartner record found');
      }
    }
  } else {
    return { contextText: `Invalid record_type: ${record_type}`, recipientEmail: '', recipientName: '', owner: '' };
  }

  const interactionPromises = [];
  if (record_type === 'client') {
    interactionPromises.push(safeFilter(base44, 'ClientInteraction', { client_id: record.id }, '-date', 20));
  } else {
    interactionPromises.push(safeFilter(base44, 'ClientInteraction', { lead_id: record.id }, '-date', 20));
    if (partner) {
      interactionPromises.push(safeFilter(base44, 'ClientInteraction', { referral_partner_id: partner.id }, '-date', 20));
    }
  }

  const eventPromises = [];
  if (record_type === 'client') {
    eventPromises.push(safeFilter(base44, 'CalendarEvent', { client_id: record.id }, '-start_date', 100));
  } else {
    eventPromises.push(safeFilter(base44, 'CalendarEvent', { lead_id: record.id }, '-start_date', 100));
    if (partner) {
      eventPromises.push(safeFilter(base44, 'CalendarEvent', { referral_partner_id: partner.id }, '-start_date', 100));
    }
  }

  const [
    interactionArrays,
    eventArrays,
    outboundEmails,
    inboundEmails,
    services,
  ] = await Promise.all([
    Promise.all(interactionPromises),
    Promise.all(eventPromises),
    recipientEmail ? safeFilter(base44, 'EmailLog', { to_email: recipientEmail }, '-date', 8) : Promise.resolve([]),
    recipientEmail ? safeFilter(base44, 'EmailLog', { from_email: recipientEmail }, '-date', 8) : Promise.resolve([]),
    safeList(base44, 'Service', 'sort_order', 200),
  ]);

  const allInteractions = interactionArrays.flat()
    .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  // Fetch 2 most recent meeting-note summaries for this record
  let meetingNoteQuery = {};
  if (record_type === 'client') {
    meetingNoteQuery = { client_id: record.id, access_status: 'captured' };
  } else if (partner) {
    meetingNoteQuery = { referral_partner_id: partner.id, access_status: 'captured' };
  } else {
    meetingNoteQuery = { lead_id: record.id, access_status: 'captured' };
  }
  const meetingNotes = await safeFilter(base44, 'MeetingNote', meetingNoteQuery, '-captured_at', 2);

  const allEvents = eventArrays.flat()
    .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  let proposals = [];
  let cohortAssessments = [];
  let feedback = [];
  let deliverySnapshot = null;

  if (record_type === 'client') {
    [proposals, cohortAssessments, feedback] = await Promise.all([
      safeFilter(base44, 'Proposal', { client_id: record.id }, '-created_date', 50),
      safeFilter(base44, 'CohortAssessment', { client_id: record.id }, '-submitted_at', 100),
      safeFilter(base44, 'FeedbackResponse', { client_id: record.id }, '-submitted_at', 100),
    ]);
    deliverySnapshot = computeDeliverySnapshot(record, proposals, allEvents, services, cohortAssessments, feedback);
  }

  const serviceNameMap = {};
  for (const s of services) {
    serviceNameMap[s.id] = s.name || s.id;
  }

  // ══ SECTION 1: CORE RECORD FIELDS ══

  if (record_type === 'client') {
    const renewalDate = getEffectiveRenewalDate(record, now);
    const daysToRenewal = daysUntilRenewal(record, now);
    const primaryContact = resolveClientContact(record);
    const contactRoster = listClientContacts(record);
    sections.push(`CLIENT RECORD:
Name: ${record.company || record.name}
Primary Contact: ${primaryContact.name
      ? `${primaryContact.name}${primaryContact.title ? ` (${primaryContact.title})` : ''}`
      : 'UNKNOWN — no human contact name is on file for this address. Address them without a name; never invent one, and never derive one from the email address.'}
Email: ${record.email || 'None'}
Contacts on file: ${contactRoster.length
      ? '\n' + contactRoster.map(c => `  - ${c.name}${c.title ? `, ${c.title}` : ''}${c.email ? ` <${c.email}>` : ''}${c.phone ? ` · ${c.phone}` : ''}${c.is_primary ? ' [primary]' : ''}`).join('\n')
      : 'none on record'}
Industry: ${record.industry || 'Unknown'}
Company Size: ${record.company_size || 'Unknown'}${record.employee_count ? ` (${record.employee_count} employees)` : ''}
Client Stage: ${record.client_stage || 'Unknown'}
Tier: ${record.tier || 'Not set'}
Tags: ${record.tags?.length ? record.tags.join(', ') : 'None'}
Owner: ${record.owner || 'Unassigned'}
Renewal Cohort: ${record.renewal_cohort || 'Not set'}
Effective Renewal Date: ${renewalDate ? `${fmtDate(renewalDate)} (${daysToRenewal !== null ? `${daysToRenewal} days away` : 'passed'})` : 'Unknown'}
Plan Year Start: ${record.plan_year_start || 'Not set'}
Last Contacted: ${record.last_contacted_date ? `${fmtDate(record.last_contacted_date)} (${daysSince(record.last_contacted_date)} days ago)` : 'Unknown'}
Last Touchpoint: ${record.last_touchpoint_date ? `${fmtDate(record.last_touchpoint_date)} (${daysSince(record.last_touchpoint_date)} days ago)` : 'Unknown'}
Last Service Date: ${record.last_service_date || 'Not set'}
Wellness Budget: ${record.wellness_budget ? fmtMoney(record.wellness_budget) : 'Unknown'}
Wellness Fund/Employee: ${record.wellness_fund_size ? fmtMoney(record.wellness_fund_size) : 'Unknown'}
Referral Partner: ${record.referral_partner_name || 'None'}
QB Invoice Value: ${fmtMoney(record.total_invoice_value)} (${record.invoice_count || 0} invoices)
Notes: ${record.notes || 'None'}`);
  } else {
    const renewalDate = partner ? getEffectiveRenewalDate(partner, now) : null;
    sections.push(`${record_type === 'partner' ? 'PARTNER' : 'LEAD'} RECORD:
Name: ${record.name}
Company: ${record.company || 'Unknown'}
Email: ${record.email || 'None'}
Title: ${record.title || 'Unknown'}
Phone: ${record.phone || 'Unknown'}
Lead Type: ${record.lead_type || 'Unknown'}
Partner Status: ${record.partner_status || 'Unknown'}
Pipeline Stage: ${record.follow_up_stage || 'No stage set'}
Status: ${record.status || 'Unknown'}
Tags: ${record.tags?.length ? record.tags.join(', ') : 'None'}
Owner: ${record.owner || 'Unassigned'}
Tier: ${partner?.tier || record.referral_potential || 'Unknown'}
Renewal Cohort: ${partner?.renewal_cohort || 'Not set'}${renewalDate ? ` (effective: ${fmtDate(renewalDate)})` : ''}
Last Contacted: ${record.last_contacted_date ? `${fmtDate(record.last_contacted_date)} (${daysSince(record.last_contacted_date)} days ago)` : 'Never'}
Last Touchpoint: ${partner?.last_touchpoint_date ? `${fmtDate(partner.last_touchpoint_date)} (${daysSince(partner.last_touchpoint_date)} days ago)` : 'Unknown'}
Last Referral: ${record.last_referral_date ? `${fmtDate(record.last_referral_date)} (${daysSince(record.last_referral_date)} days ago)` : 'None'}
Total Referrals: ${record.referral_count || 0}
Referral Potential: ${record.referral_potential || 'Unknown'}
YTD Revenue: ${fmtMoney(partner?.ytd_revenue || 0)}
Total Commissions Paid: ${fmtMoney(partner?.total_commissions_paid || 0)}
Notes: ${record.notes || 'None'}`);
  }

  // ══ SECTION 2: INTERACTION TIMELINE (last 15) ══

  if (allInteractions.length > 0) {
    const lines = allInteractions.map(i =>
      `- [${i.channel || i.interaction_type || 'note'}] ${fmtDate(i.date)}: ${i.subject || '(no subject)'}${i.outcome ? ` → ${i.outcome}` : ''}${i.notes ? ` | ${i.notes.slice(0, 100)}` : ''}${i.owner ? ` (${i.owner})` : ''}`
    ).join('\n');
    sections.push(`INTERACTION TIMELINE (last ${allInteractions.length}):\n${lines}`);
  } else {
    gaps.push('No interactions logged');
  }

  // ══ SECTION 3: EMAILS (last 8 each direction) ══

  if (outboundEmails.length > 0 || inboundEmails.length > 0) {
    const allEmails = [...outboundEmails, ...inboundEmails]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const lines = allEmails.map(e => {
      const dir = e.direction === 'outbound' ? 'WE SENT' : 'THEY SENT';
      return `- [${dir}] ${fmtDate(e.date)}: ${e.subject || '(no subject)'}${e.snippet ? ` — ${e.snippet.slice(0, 120)}` : ''}`;
    }).join('\n');
    sections.push(`EMAIL HISTORY (${outboundEmails.length} sent, ${inboundEmails.length} received):\n${lines}`);
  } else {
    gaps.push('No emails matched');
  }

  // ══ SECTION 4: PROPOSALS (clients only) ══

  if (record_type === 'client') {
    if (proposals.length > 0) {
      const lines = proposals.map(p => {
        const sel = p.selections || {};
        const serviceIds = [
          ...(sel.workshops || []),
          ...(sel.challengePrograms || []),
          ...(sel.leadership || []),
          ...(sel.movementClasses || []),
        ];
        const serviceNames = serviceIds.map(id => serviceNameMap[id] || id);
        return `- Status: ${p.status} | Total: ${fmtMoney(p.total_amount)} | Sent: ${p.sent_date ? fmtDate(p.sent_date) : 'N/A'} | Viewed: ${p.viewed_date ? fmtDate(p.viewed_date) : 'N/A'} | Stage: ${p.matched_stage || 'N/A'} | Services: ${serviceNames.length ? serviceNames.join(', ') : 'None'}`;
      }).join('\n');
      sections.push(`PROPOSALS (${proposals.length} total):\n${lines}`);
    } else {
      gaps.push('No proposals found');
    }
  }

  // ══ SECTION 5: DELIVERY SNAPSHOT (clients only) ══

  if (record_type === 'client' && deliverySnapshot) {
    const snap = deliverySnapshot;
    if (snap.hasAcceptedProposals || snap.totalServices > 0) {
      const nextEv = snap.nextEvent;
      const unscheduledNames = snap.unscheduledServices.map(s => s.name).join(', ') || 'None';
      const challengeStr = snap.challengeAssessment
        ? `Day 0: ${snap.challengeAssessment.d0 ? '✓' : '✗'}, Day 14: ${snap.challengeAssessment.d14 ? '✓' : '✗'}`
        : 'N/A (no challenges)';
      sections.push(`DELIVERY SNAPSHOT:
Services Delivered: ${snap.deliveredCount}/${snap.totalServices}
Scheduled: ${snap.scheduledCount}/${snap.totalServices}
Unscheduled (${snap.unscheduledCount}): ${unscheduledNames}
Next Event: ${nextEv ? `${nextEv.title} on ${fmtDateTime(nextEv.start_date)} (presenter: ${snap.presenterStatus})` : 'None'}
Challenge Assessments: ${challengeStr}
Feedback Responses: ${snap.feedbackCount}`);
    } else {
      gaps.push('No accepted proposals or services selected');
    }
  }

  // ══ SECTION 5.5: MFS SCORES (assessment leads only) ══

  if (record_type === 'client' && record.is_assessment_lead) {
    const mfsRows = cohortAssessments.filter(a => a.survey_type === 'mfs');
    if (mfsRows.length > 0) {
      // Group by submission ID
      const bySid = {};
      for (const row of mfsRows) {
        const sid = row.instrument_subscores?._sid || '';
        if (!sid) continue;
        if (!bySid[sid]) bySid[sid] = {};
        bySid[sid][row.instrument] = row;
      }
      const responseCount = Object.keys(bySid).length;
      const MIN_RESPONSES = 5;
      const locked = responseCount < MIN_RESPONSES;

      // Per-instrument averages
      const instrumentAvgs = {};
      for (const key of ['who5', 'pss4', 'uwes3', 'ucla3']) {
        const scores = [];
        for (const sid of Object.keys(bySid)) {
          const row = bySid[sid][key];
          if (!row) continue;
          const norm = normalizeInstrumentScore(key, row.item_responses);
          if (norm != null) scores.push(norm);
        }
        instrumentAvgs[key] = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      }

      // Composite = mean of per-respondent composites
      const perRespondent = [];
      for (const sid of Object.keys(bySid)) {
        const respondentScores = [];
        for (const key of ['who5', 'pss4', 'uwes3', 'ucla3']) {
          const row = bySid[sid][key];
          if (!row) continue;
          const norm = normalizeInstrumentScore(key, row.item_responses);
          if (norm != null) respondentScores.push(norm);
        }
        if (respondentScores.length > 0) {
          perRespondent.push(respondentScores.reduce((a, b) => a + b, 0) / respondentScores.length);
        }
      }
      const composite = perRespondent.length > 0
        ? Math.round(perRespondent.reduce((a, b) => a + b, 0) / perRespondent.length)
        : null;

      const instrumentLabels = { who5: 'Wellbeing', pss4: 'Stress', uwes3: 'Engagement', ucla3: 'Connection' };
      const scoreLines = Object.entries(instrumentLabels)
        .map(([k, label]) => `- ${label}: ${instrumentAvgs[k] != null ? instrumentAvgs[k] + '/100' : 'N/A'}`)
        .join('\n');

      sections.push(`MENTAL FITNESS SCORE (assessment lead):
Response Count: ${responseCount} (${locked ? 'locked — fewer than 5 responses, scores hidden' : 'unlocked'})
${locked ? '' : `Composite: ${composite != null ? composite + '/100' : 'N/A'}\nSub-Scores:\n${scoreLines}`}

This client came in through the Mental Fitness Score assessment. The scores above reveal where the team is struggling — use them to tailor the proposal to the weakest areas. When the proposal is accepted, the client will convert from assessment lead to a normal active client.`);
    } else {
      gaps.push('No MFS survey responses yet (assessment lead)');
    }
  }

  // ══ SECTION 6: CALENDAR EVENTS (upcoming + last 3 past) ══

  if (allEvents.length > 0) {
    const nowTs = now.getTime();
    const upcoming = allEvents
      .filter(e => new Date(e.start_date).getTime() >= nowTs)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const past = allEvents
      .filter(e => new Date(e.start_date).getTime() < nowTs)
      .slice(0, 3);

    const upLines = upcoming.slice(0, 5).map(e =>
      `- ${fmtDateTime(e.start_date)}: ${e.title} (${e.event_type})${e.completed ? ' ✓' : ''}${e.location ? ` @ ${e.location}` : ''}`
    ).join('\n');
    const pastLines = past.map(e =>
      `- ${fmtDateTime(e.start_date)}: ${e.title} (${e.event_type})${e.completed ? ' ✓' : ''}`
    ).join('\n');

    sections.push(`CALENDAR EVENTS:
Upcoming (${upcoming.length}):
${upLines || 'None'}
Last 3 Past:
${pastLines || 'None'}`);
  } else {
    gaps.push('No calendar events linked');
  }

  // ══ SECTION 6.5: RECENT MEETING NOTES (2 most recent) ══

  if (meetingNotes.length > 0) {
    const lines = meetingNotes.map(n =>
      `Meeting: ${n.meeting_title || 'Untitled'} (${n.meeting_date ? fmtDate(n.meeting_date) : 'recent'})\n${n.summary || '(no summary)'}`
    ).join('\n\n');
    sections.push(`RECENT MEETING NOTE SUMMARIES (what was actually discussed on calls):\n${lines}`);
  }

  // ══ SECTION 7: PARTNER REFERRALS (partners only) ══

  if (record_type === 'partner' && partner) {
    if (referrals.length > 0) {
      const lines = referrals.map(r =>
        `- ${r.company_name || r.contact_name} | Status: ${r.status} | Revenue: ${fmtMoney(r.first_year_revenue)} | Commission: ${fmtMoney(r.commission_amount)} (${((r.commission_rate || 0) * 100).toFixed(0)}%) | Date: ${r.referral_date ? fmtDate(r.referral_date) : 'Unknown'}`
      ).join('\n');
      const tierInfo = partner.commission_tiers?.length
        ? partner.commission_tiers.map(t => `${t.label || 'Tier'}: ${((t.rate || 0) * 100).toFixed(0)}% ($${(t.min_revenue || 0).toLocaleString()}-${(t.max_revenue || 0).toLocaleString()})`).join(', ')
        : 'None';
      sections.push(`REFERRALS (${referrals.length} total, YTD revenue placed: ${fmtMoney(partner.ytd_revenue)}):
${lines}

COMMISSION TIERS: ${tierInfo}`);
    } else {
      gaps.push('No referrals submitted yet');
    }
  }

  const gapHeader = gaps.length > 0
    ? `⚠ DATA GAPS (do not fabricate around these):\n${gaps.map(g => `- ${g}`).join('\n')}\n\n`
    : '';

  const has_rich_context = allInteractions.length > 0 || outboundEmails.length > 0 || inboundEmails.length > 0;

  return {
    contextText: gapHeader + sections.join('\n\n'),
    recipientEmail,
    recipientName,
    owner,
    has_rich_context,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD GLOBAL CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

async function buildGlobalContext(base44) {
  const now = new Date();
  const gaps = [];
  const sections = [];

  const [services, allClients, allLeads, allPartners, qbInquiryLeads] = await Promise.all([
    safeList(base44, 'Service', 'sort_order', 200),
    safeList(base44, 'Client'),
    safeFilter(base44, 'Lead', { lead_type: 'broker_lead', is_archived: { $ne: true } }),
    safeFilter(base44, 'ReferralPartner', { is_active: true }),
    safeFilter(base44, 'Lead', { lead_type: 'company_inquiry', is_archived: { $ne: true } }),
  ]);

  // Exclude demo + internal clients from Maya's briefing/pipeline context.
  // Internal clients (SkillfulMeans test client) are real sessions but never
  // appear in business counts or follow-up items.
  const clients = allClients.filter(c => !c.is_demo && !c.is_internal && !c.is_assessment_lead);
  const leads = allLeads.filter(l => !l.is_demo);
  const partners = allPartners.filter(p => !p.is_demo);
  const qbInquiries = qbInquiryLeads.filter(l => !l.is_demo);

  // ══ SECTION 1: SERVICE CATALOG ══

  if (services.length > 0) {
    const lines = services.map(s =>
      `- ${s.name} [${s.category}] — ${s.short_description || (s.description ? s.description.slice(0, 80) : 'No description')}${s.price ? ` | ${fmtMoney(s.price)}` : ''}`
    ).join('\n');
    sections.push(`SERVICE CATALOG (${services.length} services):\n${lines}\n\n${PRICING_RULES}`);
  } else {
    gaps.push('No services in catalog');
  }

  // ══ SECTION 2: PIPELINE COUNTS BY STAGE ══

  const clientStageCounts = {};
  for (const c of clients) {
    const stage = c.client_stage || 'unknown';
    clientStageCounts[stage] = (clientStageCounts[stage] || 0) + 1;
  }

  const leadStatusCounts = {};
  for (const l of leads) {
    const status = l.status || 'unknown';
    leadStatusCounts[status] = (leadStatusCounts[status] || 0) + 1;
  }

  const activeClients = clients.filter(c => c.client_stage && c.client_stage !== 'churned').length;
  const activePartners = partners.filter(p => p.partner_status === 'Active Partner').length;

  sections.push(`PIPELINE COUNTS:
Active Clients: ${activeClients} / ${clients.length} total
Active Partners: ${activePartners} / ${partners.length} total
Client Stages: ${Object.entries(clientStageCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'}
Lead Statuses: ${Object.entries(leadStatusCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'}`);

  // ══ SECTION 3: RENEWAL SEASON STATUS ══

  const cohort = getActiveCohort(now);
  if (cohort) {
    const renewalClients = clients.filter(c => c.renewal_cohort === cohort.label);
    sections.push(`RENEWAL SEASON:
Active Cohort: ${cohort.label} (${cohort.daysRemaining} days remaining)
Clients in cohort: ${renewalClients.length}
${renewalClients.slice(0, 10).map(c => `- ${c.company || c.name} (owner: ${c.owner || 'unassigned'}, stage: ${c.client_stage || 'unknown'})`).join('\n') || 'None'}`);
  } else {
    sections.push(`RENEWAL SEASON: No active renewal ramp (next cohort > ${RAMP_DAYS} days out).`);
  }

  // ══ SECTION 4: NEW QUICK BUILDER INQUIRIES ══

  const newInquiries = qbInquiries.filter(l =>
    (l.source || '').startsWith('Quick Builder') &&
    (l.status || 'cold') === 'cold' &&
    !l.last_contacted_date
  );

  if (newInquiries.length > 0) {
    const lines = newInquiries.map(l =>
      `- ${l.company || l.name} (team: ${l.company_size || '?'}, ${l.quickbuilder_selections?.length || 0} services selected, est: ${fmtMoney(l.estimated_investment)}, submitted: ${l.created_date ? fmtDate(l.created_date) : 'recently'})`
    ).join('\n');
    sections.push(`NEW QUICK BUILDER INQUIRIES (${newInquiries.length} awaiting first contact):\n${lines}`);
  } else {
    sections.push(`NEW QUICK BUILDER INQUIRIES: 0 awaiting first contact.`);
  }

  const gapHeader = gaps.length > 0
    ? `⚠ DATA GAPS (do not fabricate around these):\n${gaps.map(g => `- ${g}`).join('\n')}\n\n`
    : '';

  return {
    contextText: gapHeader + sections.join('\n\n'),
    data: {
      services,
      clients,
      leads,
      partners,
      qbInquiries,
      newInquiries,
      activeCohort: cohort,
    },
    stats: {
      activeClients,
      activePartners,
      newInquiries: newInquiries.length,
      renewalCohort: cohort ? cohort.label : null,
      renewalDaysRemaining: cohort ? cohort.daysRemaining : null,
      renewalClientCount: cohort ? clients.filter(c => c.renewal_cohort === cohort.label).length : 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE CACHE — 5-minute in-memory TTL (entries change rarely)
// ═══════════════════════════════════════════════════════════════════════════

const KNOWLEDGE_TTL = 5 * 60 * 1000; // 5 minutes
let _knowledgeCache = null; // { entries, fetchedAt }

async function getKnowledgeEntries(base44) {
  const now = Date.now();
  if (_knowledgeCache && (now - _knowledgeCache.fetchedAt) < KNOWLEDGE_TTL) {
    return _knowledgeCache.entries;
  }
  const entries = await safeFilter(base44, 'MayaKnowledge', { is_active: true }, '-updated_date', 100);
  _knowledgeCache = { entries, fetchedAt: now };
  return entries;
}

// ── Select 2–3 most relevant entries via keyword matching on question + title/slug ──

function selectRelevantKnowledge(entries, question) {
  if (entries.length <= 3) return entries;
  if (!question || typeof question !== 'string') return entries.slice(0, 3);

  const questionLower = question.toLowerCase();
  const questionWords = [...new Set(questionLower.split(/\W+/).filter(w => w.length > 2))];
  if (questionWords.length === 0) return entries.slice(0, 3);

  const scored = entries.map(entry => {
    const titleLower = (entry.title || '').toLowerCase();
    const slugLower = (entry.slug || '').toLowerCase();
    const contentLower = (entry.content || '').toLowerCase();
    let score = 0;
    for (const word of questionWords) {
      if (titleLower.includes(word)) score += 3;
      if (slugLower.includes(word)) score += 2;
      if (contentLower.includes(word)) score += 1;
    }
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score > 0) {
    return scored.filter(s => s.score > 0).slice(0, 3).map(s => s.entry);
  }
  return entries.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET KNOWLEDGE — cached fetch + keyword-trimmed selection (2–3 entries max)
// ═══════════════════════════════════════════════════════════════════════════

async function getKnowledge(base44, categories, question) {
  const gaps = [];
  const sections = [];

  const entries = await getKnowledgeEntries(base44); // cached
  const filtered = entries.filter(e => categories.includes(e.category));
  const selected = selectRelevantKnowledge(filtered, question);

  if (selected.length > 0) {
    for (const entry of selected) {
      sections.push(`## ${entry.title}\nCategory: ${entry.category} | Slug: ${entry.slug}\n\n${entry.content || '(no content)'}`);
    }
  } else {
    gaps.push(`No knowledge entries found for categories: ${categories.join(', ')}`);
  }

  const gapHeader = gaps.length > 0
    ? `⚠ DATA GAPS (do not fabricate around these):\n${gaps.map(g => `- ${g}`).join('\n')}\n\n`
    : '';

  return {
    contextText: gapHeader + sections.join('\n\n---\n\n'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD DELIVERY CONTEXT — today/tomorrow sessions, presenter gaps,
// challenge assessment gaps, unscheduled services, renewal review gaps.
// Invoked by mayaDailyBriefing (action='delivery').
// ═══════════════════════════════════════════════════════════════════════════

async function buildDeliveryContext(base44) {
  const now = new Date();
  const startToday = startOfDay(now);
  const endTomorrow = new Date(startToday);
  endTomorrow.setDate(endTomorrow.getDate() + 2);

  const [services, allClients, events, proposals, cohortAssessments, recentProposalsRaw] = await Promise.all([
    safeList(base44, 'Service', 'sort_order', 200),
    safeList(base44, 'Client'),
    safeFilter(base44, 'CalendarEvent', {}, '-start_date', 500),
    safeFilter(base44, 'Proposal', { status: 'accepted' }, '-created_date', 200),
    safeFilter(base44, 'CohortAssessment', {}, '-submitted_at', 500),
    safeFilter(base44, 'Proposal', {}, '-created_date', 200),
  ]);

  // Exclude demo + internal clients from delivery intelligence.
  const clients = allClients.filter(c => !c.is_demo && !c.is_internal && !c.is_assessment_lead);
  const cleanServices = services.filter(s => !s.is_demo);
  const cleanEvents = events.filter(e => !e.is_demo);

  // DELIVERY follow-ups only ever apply to work the client actually bought. A proposal
  // sitting in draft/sent/viewed is still a SALES conversation — promo emails and wellness
  // box asks against it were the bug William reported (Great Minds, sent since February,
  // was generating delivery tasks). 'fulfilled' counts: it means accepted, then delivered.
  const wonProposals = recentProposalsRaw.filter(p =>
    !p.is_demo && (p.status === 'accepted' || p.status === 'fulfilled')
  );

  // ── Today/tomorrow DELIVERY sessions with presenter-acceptance gaps ──
  // Meetings (1:1s, networking calls, discovery) are not deliveries and have no presenter,
  // so including them produced nonsense like "Remote Networking Chat — presenter NOT
  // accepted". Same rule the Schedule page uses for its Delivery/Meetings lenses.
  const inWindow = (e) => {
    const d = new Date(e.start_date);
    return d >= startToday && d < endTomorrow;
  };
  const byStart = (a, b) => new Date(a.start_date) - new Date(b.start_date);

  const todayTomorrow = cleanEvents.filter(e => inWindow(e) && isDeliveryEvent(e)).sort(byStart);
  const todayTomorrowMeetings = cleanEvents.filter(e => inWindow(e) && !isDeliveryEvent(e)).sort(byStart);

  const presenterGaps = todayTomorrow.filter(e =>
    !e.completed && e.presenter_accepted !== true
  );

  // ── Challenges missing day-0 / day-14 assessments ──
  const clientChallengeMap = {};
  for (const p of proposals) {
    const sel = p.selections || {};
    const chIds = (sel.challengePrograms || []);
    if (chIds.length === 0) continue;
    if (!clientChallengeMap[p.client_id]) clientChallengeMap[p.client_id] = new Set();
    chIds.forEach(id => clientChallengeMap[p.client_id].add(id));
  }

  const challengeGaps = [];
  for (const [clientId, svcIds] of Object.entries(clientChallengeMap)) {
    const client = clients.find(c => c.id === clientId);
    if (!client) continue;
    // Skip challenges that ended more than 14 days ago — no longer actionable.
    const clientChallengeEvents = cleanEvents.filter(e =>
      e.event_type === 'challenge' && e.client_id === clientId
    );
    if (clientChallengeEvents.length > 0) {
      const latestEnd = clientChallengeEvents.reduce((latest, e) => {
        let endRef = e.end_date ? new Date(e.end_date) : null;
        if (!endRef || isNaN(endRef.getTime())) {
          endRef = new Date(e.start_date);
          endRef.setDate(endRef.getDate() + 14);
        }
        return endRef > latest ? endRef : latest;
      }, new Date(0));
      // daysBetween is this file's helper (daysDiff only exists in mayaDailyBriefing —
      // the undefined reference crashed the delivery context from 2026-08-17 onward).
      if (daysBetween(latestEnd, now) > 14) continue;
    }
    let d0 = false, d14 = false;
    for (const a of cohortAssessments) {
      if (a.client_id !== clientId) continue;
      if (!svcIds.has(a.service_id)) continue;
      if (a.survey_type === 'challenge_day0') d0 = true;
      if (a.survey_type === 'challenge_day14') d14 = true;
    }
    if (!d0 || !d14) {
      challengeGaps.push({
        client: client.company || client.name,
        missing: [!d0 && 'Day 0', !d14 && 'Day 14'].filter(Boolean).join(' + '),
      });
    }
  }

  // ── Unscheduled services count (aggregate across active clients) ──
  let unscheduledTotal = 0;
  let clientsWithDelivery = 0;
  for (const client of clients) {
    const snap = computeDeliverySnapshot(client, proposals, cleanEvents, cleanServices, cohortAssessments, []);
    if (snap.hasAcceptedProposals || snap.totalServices > 0) {
      unscheduledTotal += snap.unscheduledCount;
      clientsWithDelivery++;
    }
  }

  // ── Renewal review gaps (only during an active cohort ramp) ──
  const cohort = getActiveCohort(now);
  let renewalReviewGaps = [];
  if (cohort) {
    const cohortClients = clients.filter(c => c.renewal_cohort === cohort.label);
    const upcomingReviews = cleanEvents.filter(e => {
      if (new Date(e.start_date) < startToday) return false;
      return e.event_type === 'meeting' || /review|strategic|renewal/i.test(e.title || '');
    });
    const reviewedClientIds = new Set(upcomingReviews.map(e => e.client_id).filter(Boolean));
    renewalReviewGaps = cohortClients
      .filter(c => !reviewedClientIds.has(c.id))
      .map(c => ({
        client: c.company || c.name,
        daysRemaining: daysUntilRenewal(c, now),
        owner: c.owner || 'unassigned',
      }))
      .filter(g => g.daysRemaining !== null)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  // ── Reminder candidates (30-day lookback; deduped in mayaDailyBriefing) ──
  const SESSION_TYPES = ['workshop', 'class', 'leadership', 'presentation'];
  const todayMinus30 = new Date(startToday);
  todayMinus30.setDate(todayMinus30.getDate() - 30);
  const todayMinus14 = new Date(startToday);
  todayMinus14.setDate(todayMinus14.getDate() - 14);
  const todayMinus3 = new Date(startToday);
  todayMinus3.setDate(todayMinus3.getDate() - 3);
  const todayPlus7 = new Date(startToday);
  todayPlus7.setDate(todayPlus7.getDate() + 7);

  const reminderCandidates = [];

  // a) Workshop/class/leadership/presentation recordings — send recording + materials
  for (const e of cleanEvents) {
    if (!SESSION_TYPES.includes(e.event_type)) continue;
    const endRef = e.end_date ? new Date(e.end_date) : new Date(e.start_date);
    const dayStart = startOfDay(endRef);
    if (dayStart < todayMinus30 || dayStart >= startToday) continue;
    const triggerDate = new Date(dayStart);
    triggerDate.setDate(triggerDate.getDate() + 1);
    const client = e.client_name || '';
    reminderCandidates.push({
      type: 'workshop_recording',
      key: 'workshop_recording:' + e.id,
      client,
      clientId: e.client_id || '',
      eventId: e.id,
      triggerDate: triggerDate.toISOString().slice(0, 10),
      text: `${client} — send recording + materials for "${e.title}" (held ${fmtDate(e.start_date)})${e.recording_link ? '' : ' — recording NOT yet submitted by presenter'}`,
    });
  }

  // b) Challenge reports — send challenge report
  // Only surface challenges that ended within the last 14 days; older ones are stale.
  for (const e of cleanEvents) {
    if (e.event_type !== 'challenge') continue;
    let endRef = e.end_date ? new Date(e.end_date) : null;
    if (!endRef || isNaN(endRef.getTime())) {
      endRef = new Date(e.start_date);
      endRef.setDate(endRef.getDate() + 14);
    }
    const dayStart = startOfDay(endRef);
    if (dayStart < todayMinus14 || dayStart >= startToday) continue;
    const triggerDate = new Date(dayStart);
    triggerDate.setDate(triggerDate.getDate() + 1);
    const client = e.client_name || '';
    reminderCandidates.push({
      type: 'challenge_report',
      key: 'challenge_report:' + e.id,
      client,
      clientId: e.client_id || '',
      eventId: e.id,
      triggerDate: triggerDate.toISOString().slice(0, 10),
      text: `${client} — send challenge report for "${e.title}" (ended ${fmtDate(endRef)})`,
    });
  }

  // c) Week-out confirmations — send client reminder + confirm Zoom details
  for (const e of cleanEvents) {
    if (!SESSION_TYPES.includes(e.event_type) || e.completed) continue;
    const dayStart = startOfDay(new Date(e.start_date));
    if (dayStart < startToday || dayStart > todayPlus7) continue;
    const triggerDate = new Date(dayStart);
    triggerDate.setDate(triggerDate.getDate() - 7);
    const client = e.client_name || '';
    const hasLink = !!(e.meeting_link || (e.location && e.location.startsWith('http')));
    reminderCandidates.push({
      type: 'week_out_confirmation',
      key: 'week_out_confirmation:' + e.id,
      client,
      clientId: e.client_id || '',
      eventId: e.id,
      triggerDate: triggerDate.toISOString().slice(0, 10),
      text: `${client} — send session reminder + confirm Zoom details for "${e.title}" (${fmtDateTime(e.start_date)})${hasLink ? '' : ' — NO meeting link on event'}${e.invite_sent ? '' : ' — calendar invite not sent'}`,
    });
  }

  // d) Proposal promos — send promotional emails for workshops/challenges/events.
  // Anchored on acceptance, not creation: a proposal written in March and accepted in
  // August needs its promo push in August. accepted_date is stamped on the status change;
  // updated_date is the fallback for records that predate the field.
  for (const p of wonProposals) {
    const dayStart = startOfDay(new Date(p.accepted_date || p.updated_date || p.created_date));
    if (dayStart < todayMinus30 || dayStart >= startToday) continue;
    const triggerDate = new Date(dayStart);
    triggerDate.setDate(triggerDate.getDate() + 1);
    const client = p.client_name || p.company || '';
    reminderCandidates.push({
      type: 'proposal_promo',
      key: 'proposal_promo:' + p.id,
      client,
      clientId: p.client_id || '',
      proposalId: p.id,
      triggerDate: triggerDate.toISOString().slice(0, 10),
      text: `${client} — send promotional emails for the workshops/challenges/events on their proposal (accepted ${fmtDate(p.accepted_date || p.updated_date || p.created_date)})`,
    });
  }

  // e) Wellness box follow-ups — ask which themes + mailing plan
  for (const p of wonProposals) {
    const dayStart = startOfDay(new Date(p.accepted_date || p.updated_date || p.created_date));
    if (dayStart < todayMinus30 || dayStart > todayMinus3) continue;
    const sel = p.selections || {};
    const hasSampleBoxes = Object.values(sel.sampleBoxQuantities || {}).some(v => Number(v) > 0);
    const hasWellnessBoxes = (sel.wellnessBoxes || []).some(v => Number(v) > 0);
    const hasCustomBox = Number(sel.customBoxQuantity) > 0;
    if (!hasSampleBoxes && !hasWellnessBoxes && !hasCustomBox) continue;
    const triggerDate = new Date(dayStart);
    triggerDate.setDate(triggerDate.getDate() + 3);
    const sampleTotal = Object.values(sel.sampleBoxQuantities || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const wellnessTotal = (sel.wellnessBoxes || []).reduce((s, v) => s + (Number(v) || 0), 0);
    const customTotal = Number(sel.customBoxQuantity) || 0;
    const boxCount = sampleTotal + wellnessTotal + customTotal;
    const client = p.client_name || p.company || '';
    reminderCandidates.push({
      type: 'wellness_box',
      key: 'wellness_box:' + p.id,
      client,
      clientId: p.client_id || '',
      proposalId: p.id,
      triggerDate: triggerDate.toISOString().slice(0, 10),
      text: `${client} — ask which wellness box theme(s) they'd like and when/how to mail them (e.g. 5 after the workshop, 10 to challenge winners) — ${boxCount} boxes on proposal accepted ${fmtDate(p.accepted_date || p.updated_date || p.created_date)}`,
    });
  }

  return {
    todayTomorrowCount: todayTomorrow.length,
    // Meetings are surfaced separately so the brief can say "2 deliveries, 3 meetings"
    // instead of lumping a networking call in with a workshop.
    todayTomorrowMeetingCount: todayTomorrowMeetings.length,
    todayTomorrowMeetings: todayTomorrowMeetings.map(e => ({
      title: e.title,
      start: fmtDateTime(e.start_date),
      client: e.client_name || '',
    })),
    presenterGapCount: presenterGaps.length,
    presenterGapSessions: presenterGaps.map(e => ({
      title: e.title,
      start: fmtDateTime(e.start_date),
      client: e.client_name || '',
      status: e.presenter_declined_at ? 'declined' : (e.presenter_id ? 'assigned-not-accepted' : 'unassigned'),
    })),
    todayTomorrowSessions: todayTomorrow.map(e => ({
      title: e.title,
      start: fmtDateTime(e.start_date),
      client: e.client_name || '',
      completed: !!e.completed,
      presenterAccepted: e.presenter_accepted === true,
    })),
    challengeAssessmentGaps: challengeGaps,
    unscheduledServicesTotal: unscheduledTotal,
    clientsWithDelivery,
    activeCohort: cohort,
    renewalReviewGaps,
    reminderCandidates,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Accept if EITHER a valid user session exists OR the internal key matches
    // (lets already-authenticated Maya functions call mayaContext server-side).
    const INTERNAL_KEY = Deno.env.get('MAYA_INTERNAL_KEY');
    const hasInternalKey = !!(INTERNAL_KEY && body.internal_key && body.internal_key === INTERNAL_KEY);

    let user = null;
    if (!hasInternalKey) {
      try {
        user = await base44.auth.me();
      } catch (e) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = body;

    if (action === 'record') {
      const { record_type, record_id } = body;
      if (!record_type || !record_id) {
        return Response.json({ error: 'Missing record_type or record_id' }, { status: 400 });
      }
      const result = await buildRecordContext(base44, record_type, record_id);
      return Response.json(result);
    }

    if (action === 'global') {
      const result = await buildGlobalContext(base44);
      return Response.json(result);
    }

    if (action === 'delivery') {
      const result = await buildDeliveryContext(base44);
      return Response.json(result);
    }

    if (action === 'persona') {
      return Response.json({ persona: MAYA_PERSONA });
    }

    if (action === 'knowledge') {
      const { categories, question } = body;
      if (!categories || !Array.isArray(categories)) {
        return Response.json({ error: 'Missing categories array' }, { status: 400 });
      }
      const result = await getKnowledge(base44, categories, question);
      return Response.json(result);
    }

    // ── BUNDLE: record + knowledge + persona (+ optional global) in ONE call ──
    // Eliminates 3–4 separate invokes from each caller.
    // Knowledge uses 5-min cache + keyword trimming on `question`.
    if (action === 'bundle') {
      const { record_type, record_id, include_global, question, categories } = body;
      const cats = categories || ['sales_process', 'products', 'positioning', 'delivery'];

      const tasks = [
        getKnowledge(base44, cats, question),
      ];
      if (include_global) tasks.push(buildGlobalContext(base44));
      if (record_type && record_id) tasks.push(buildRecordContext(base44, record_type, record_id));

      const results = await Promise.all(tasks);

      const response = { persona: MAYA_PERSONA };
      response.knowledgeText = results[0].contextText;

      let idx = 1;
      if (include_global) {
        response.globalText = results[idx].contextText;
        response.globalData = results[idx].data;
        response.globalStats = results[idx].stats;
        idx++;
      }
      if (record_type && record_id) {
        response.recordText = results[idx].contextText;
        response.recipientEmail = results[idx].recipientEmail;
        response.recipientName = results[idx].recipientName;
        response.owner = results[idx].owner;
        response.has_rich_context = results[idx].has_rich_context;
      }

      return Response.json(response);
    }

    return Response.json({ error: `Unknown action: ${action}. Use 'record', 'global', 'delivery', 'knowledge', 'persona', or 'bundle'.` }, { status: 400 });
  } catch (error) {
    console.error('Unhandled error in mayaContext:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});