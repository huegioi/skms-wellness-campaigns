import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getOrgDomain } from '../../shared/emailDomain.ts';

// ─────────────────────────────────────────────────────────────────────────────
// seedDemoData — full sales-showcase seed for SKMS broker demos.
//
// Every created record carries is_demo: true. All sales-showcase emails are
// @example.com (the inline MFS demo block is preserved untouched and retains
// its existing @*-demo.com addresses). This function NEVER sends email, NEVER
// creates ScheduledSurveySend / SurveyInvite / EmailLog records, and NEVER
// creates Google Calendar invites — events are stamped is_demo:true with no
// google_event_id, so all downstream sync/invite/survey guards skip them.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_TAG = 'Demo';

const STANDARD_COMMISSION_TIERS = [
  { min_revenue: 0, max_revenue: 10000, rate: 0.10, label: 'Tier 1 (0-10k)' },
  { min_revenue: 10000, max_revenue: 25000, rate: 0.12, label: 'Tier 2 (10k-25k)' },
  { min_revenue: 25000, max_revenue: null, rate: 0.15, label: 'Tier 3 (25k+)' },
];

const FIRST_NAMES = ['Sarah','Michael','Jessica','David','Emily','Christopher','Amanda','Daniel','Lauren','Matthew','Rachel','Andrew','Megan','Tyler','Nicole','Brandon','Stephanie','Kevin','Ashley','Justin','Brittany','Nathan','Katherine','Ryan','Eric','Samantha','Brian','Christine','Jason','Melissa','Adam','Danielle','Laura','Sean','Greg','Vanessa','Derek','Monica','Travis','Hannah'];
const LAST_NAMES = ['Carter','Bennett','Foster','Reyes','Hughes','Sullivan','Ward','Coleman','Brooks','Gray','Powell','Russell','Long','Webb','Perry','Hamilton','Graham','Wallace','Woods','Dixon','Burns','Henry','Freeman','Hicks','Knight','Shaw','Strickland','Bishop','Fleming','Manning','Nguyen','Patel','Romero','Spencer','Fischer','Owens'];

const BEHAVIOR_INTENTS = [
  'Use box breathing before stressful meetings',
  'Take a 5-minute walk after lunch each day',
  'Practice the 4-7-8 technique at bedtime',
  'Pause and name my emotion before responding',
  'Block 30 minutes for deep work before email',
  'Use the two-minute reset between calls',
  'Write down three wins before logging off',
  'Do a body scan when I notice shoulder tension',
  'Take a real lunch break away from my desk',
  'Set a hard stop at 5:30 twice a week',
  'Start my morning with two minutes of slow breathing',
  'Ask a colleague one curious question before advising'
];
const IMPACT_OPTIONS = ['Personal well-being and stress levels','Daily focus and productivity','Communication and teamwork','Resilience and workplace challenges','Overall job satisfaction'];
const TAKEAWAYS = [
  'The breathing technique helped before a hard client call',
  'I did not realize how much tension I carry in my shoulders',
  'The pause-before-responding tip changed a difficult conversation',
  'A real lunch break made my afternoons much sharper',
  'I shared the 4-7-8 method with my team and two tried it',
  'Naming my emotion stopped a reactive email I would have regretted',
  'The deep-work block was my most productive hour in weeks',
  'I slept better the night I tried the bedtime routine'
];

// ── small helpers ──
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function pickN(a, n) { const c = [...a], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return o; }
function sampleN(arr, n) { const c = [...arr], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return o; }
function makeToken(p) { return p + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20); }
function isoAt(daysOffset, hour, min) { const x = new Date(); x.setDate(x.getDate() + daysOffset); x.setHours(hour, min || 0, 0, 0); return x.toISOString(); }
function dateAt(daysOffset) { const x = new Date(); x.setDate(x.getDate() + daysOffset); return x.toISOString().split('T')[0]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function jitter(center, pct) { return center * (1 + (Math.random() * 2 - 1) * pct); }

// @example.com participant pool for the sales showcase
function pool(prefix, n) {
  const seen = new Set(); const out = [];
  while (out.length < n) {
    const f = pick(FIRST_NAMES), l = pick(LAST_NAMES);
    const email = (prefix + '.' + f + '.' + l + '@example.com').toLowerCase();
    if (seen.has(email)) continue; seen.add(email);
    out.push({ name: f + ' ' + l, email });
  }
  return out;
}

// generate `count` integers in [min,max] summing to ~targetSum (noise-preserving)
function itemsForSum(count, min, max, targetSum) {
  const items = new Array(count).fill(min);
  let remaining = clamp(targetSum - min * count, 0, (max - min) * count);
  let guard = 0;
  while (remaining > 0 && guard < count * 8) {
    const idx = randInt(0, count - 1);
    if (items[idx] < max) { items[idx]++; remaining--; }
    guard++;
  }
  // shuffle units between items to add variance without changing sum
  for (let k = 0; k < count; k++) {
    const a = randInt(0, count - 1), b = randInt(0, count - 1);
    if (a !== b && items[a] < max && items[b] > min) { items[a]++; items[b]--; }
  }
  return items;
}

// ── instrument record builders ──
function who5Record(clientId, proposalId, serviceId, p, surveyType, targetTotal, submittedAt) {
  const items = itemsForSum(5, 0, 5, Math.round(targetTotal / 4));
  const sum = items.reduce((s, v) => s + v, 0);
  const total = sum * 4;
  return {
    client_id: clientId, service_id: serviceId || undefined, proposal_id: proposalId,
    participant_email: p.email, survey_type: surveyType, instrument: 'who5', instrument_total: total,
    item_responses: { q1: items[0], q2: items[1], q3: items[2], q4: items[3], q5: items[4] },
    who5_cheerful: items[0], who5_calm: items[1], who5_active: items[2], who5_rested: items[3], who5_interested: items[4],
    who5_total: total, cohort_year: new Date(submittedAt).getFullYear(), submitted_at: submittedAt, is_demo: true,
  };
}
function uwes3Record(clientId, proposalId, serviceId, p, surveyType, targetMean, submittedAt) {
  const items = itemsForSum(3, 0, 6, Math.round(targetMean * 3));
  const sum = items.reduce((s, v) => s + v, 0);
  const mean = Math.round((sum / 3) * 100) / 100;
  return {
    client_id: clientId, service_id: serviceId || undefined, proposal_id: proposalId,
    participant_email: p.email, survey_type: surveyType, instrument: 'uwes3', instrument_total: mean,
    item_responses: { q1: items[0], q2: items[1], q3: items[2] },
    cohort_year: new Date(submittedAt).getFullYear(), submitted_at: submittedAt, is_demo: true,
  };
}
function pss4Record(clientId, proposalId, serviceId, p, surveyType, targetTotal, submittedAt) {
  const items = itemsForSum(4, 0, 4, Math.round(targetTotal));
  const sum = items.reduce((s, v) => s + v, 0);
  return {
    client_id: clientId, service_id: serviceId || undefined, proposal_id: proposalId,
    participant_email: p.email, survey_type: surveyType, instrument: 'pss4', instrument_total: sum,
    item_responses: { q1: items[0], q2: items[1], q3: items[2], q4: items[3] },
    cohort_year: new Date(submittedAt).getFullYear(), submitted_at: submittedAt, is_demo: true,
  };
}
function ucla3Record(clientId, proposalId, serviceId, p, surveyType, targetTotal, submittedAt) {
  const items = itemsForSum(3, 1, 3, Math.round(targetTotal));
  const sum = items.reduce((s, v) => s + v, 0);
  return {
    client_id: clientId, service_id: serviceId || undefined, proposal_id: proposalId,
    participant_email: p.email, survey_type: surveyType, instrument: 'ucla3', instrument_total: sum,
    item_responses: { q1: items[0], q2: items[1], q3: items[2] },
    cohort_year: new Date(submittedAt).getFullYear(), submitted_at: submittedAt, is_demo: true,
  };
}
function cbiRecord(clientId, proposalId, serviceId, p, surveyType, targetTotal, submittedAt) {
  const personal = clamp(Math.round(targetTotal + jitter(0, 5)), 0, 100);
  const work = clamp(Math.round(targetTotal + jitter(0, 5)), 0, 100);
  const colleague = clamp(Math.round(targetTotal + jitter(0, 5)), 0, 100);
  return {
    client_id: clientId, service_id: serviceId || undefined, proposal_id: proposalId,
    participant_email: p.email, survey_type: surveyType, instrument: 'cbi', instrument_total: Math.round(targetTotal),
    item_responses: { personal, work, colleague },
    cohort_year: new Date(submittedAt).getFullYear(), submitted_at: submittedAt, is_demo: true,
  };
}

// per-participant trajectory: baseline → mid → end → month1, with ~15% improvement
function trajectory() {
  const who5b = clamp(Math.round(jitter(52, 0.10)), 34, 70);
  const pss4b = clamp(Math.round(jitter(9, 0.10)), 6, 13);
  const ucla3b = clamp(randInt(5, 7), 4, 8);
  const cbiB = clamp(Math.round(jitter(48, 0.08)), 36, 58);
  const uwes3b = clamp(Math.round(jitter(3.2, 0.08) * 100) / 100, 2.3, 4.0);

  const who5e = clamp(Math.round(who5b * 1.16 + jitter(0, 3)), who5b + 6, 86);
  const pss4e = clamp(Math.round(pss4b * 0.76), 3, pss4b - 1);
  const ucla3e = clamp(ucla3b - 2, 3, ucla3b - 1);
  const cbiE = clamp(Math.round(cbiB * 0.72), 20, cbiB - 6);
  const uwes3e = clamp(Math.round(uwes3b * 1.22 * 100) / 100, uwes3b + 0.4, 5.6);

  const who5mid = clamp(Math.round(who5b + (who5e - who5b) * 0.5), who5b + 2, who5e - 2);
  const who5m1 = clamp(Math.round(who5e - jitter(2, 0.1)), who5b + 5, who5e);

  return {
    baseline: { who5: who5b, uwes3: uwes3b, pss4: pss4b, ucla3: ucla3b, cbi: cbiB },
    mid: { who5: who5mid },
    end: { who5: who5e, uwes3: uwes3e, pss4: pss4e, ucla3: ucla3e, cbi: cbiE },
    month1: { who5: who5m1, uwes3: uwes3e, pss4: pss4e, ucla3: ucla3e, cbi: cbiE },
  };
}

const ALL_INSTRUMENTS = ['who5', 'uwes3', 'pss4', 'ucla3', 'cbi'];

function phaseRecords(clientId, proposalId, serviceId, p, phase, instruments, scores, submittedAt) {
  const recs = [];
  for (const inst of instruments) {
    const t = scores[inst];
    if (t === undefined || t === null) continue;
    if (inst === 'who5') recs.push(who5Record(clientId, proposalId, serviceId, p, phase, t, submittedAt));
    else if (inst === 'uwes3') recs.push(uwes3Record(clientId, proposalId, serviceId, p, phase, t, submittedAt));
    else if (inst === 'pss4') recs.push(pss4Record(clientId, proposalId, serviceId, p, phase, t, submittedAt));
    else if (inst === 'ucla3') recs.push(ucla3Record(clientId, proposalId, serviceId, p, phase, t, submittedAt));
    else if (inst === 'cbi') recs.push(cbiRecord(clientId, proposalId, serviceId, p, phase, t, submittedAt));
  }
  return recs;
}

function genNps(bias) {
  const r = Math.random();
  if (bias === 'high') {            // Lakeside ~ +50
    if (r < 0.68) return randInt(9, 10);
    if (r < 0.82) return randInt(7, 8);
    return Math.random() < 0.6 ? randInt(5, 6) : randInt(0, 4);
  }
  if (bias === 'mid') {             // Brightpath ~ +35
    if (r < 0.58) return randInt(9, 10);
    if (r < 0.78) return randInt(7, 8);
    return Math.random() < 0.6 ? randInt(5, 6) : randInt(0, 4);
  }
  // 'early' Meridian (small N)
  if (r < 0.66) return randInt(9, 10);
  if (r < 0.80) return randInt(7, 8);
  return Math.random() < 0.7 ? randInt(5, 6) : randInt(0, 4);
}

// ── event record builder ──
function eventRecord(client, proposalId, daysOffset, hour, durationHours, eventType, title, completed, serviceInfo) {
  const start = new Date(); start.setDate(start.getDate() + daysOffset); start.setHours(hour, 0, 0, 0);
  const end = new Date(start); end.setHours(end.getHours() + durationHours);
  return {
    title, event_type: eventType, start_date: start.toISOString(), end_date: end.toISOString(),
    client_id: client.id, client_name: client.company, service_id: serviceInfo ? serviceInfo.id : undefined,
    proposal_id: proposalId, presenter: 'Jordan Lee', presenter_accepted: true, presenter_email: 'jordan.lee@skillfulmeans.life',
    delivery_format: daysOffset < -200 ? 'virtual' : (Math.random() > 0.5 ? 'virtual' : 'hybrid'),
    completed, completed_date: completed ? start.toISOString() : undefined,
    checkin_token: crypto.randomUUID(), invite_sent: false, ingested: false, is_demo: true,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }
    const origin = new URL(req.url).origin;
    const now = new Date();

    // ── Guard: block seeding while demo data already exists ──
    const [existingClients, existingPartners] = await Promise.all([
      base44.asServiceRole.entities.Client.filter({ is_demo: true }, '-created_date', 1).catch(() => []),
      base44.asServiceRole.entities.ReferralPartner.filter({ is_demo: true }, '-created_date', 1).catch(() => []),
    ]);
    if (existingClients.length || existingPartners.length) {
      return Response.json({ error: 'Demo data already exists — purge before seeding again.' }, { status: 409 });
    }

    // ── Services (reference real catalog IDs where available) ──
    const services = await base44.asServiceRole.entities.Service.list('sort_order', 200);
    const svcByCat = {};
    for (const s of services) { (svcByCat[s.category] ||= []).push(s); }
    const svc = (cat, fallback) => {
      const s = svcByCat[cat] && svcByCat[cat][0];
      return { id: s ? s.id : undefined, name: s ? s.name : fallback, category: cat, qbItem: s ? s.quickbooks_item_id : undefined };
    };
    const workshopSvc = svc('workshop', 'Beyond Burnout: From Pressure to Presence');
    const challengeSvc = svc('challenge', '14-Day Mental Fitness Challenge');
    const leadershipSvc = svc('leadership', 'Leading Under Pressure');
    const boxSvc = svc('wellness_box', 'Reduce Stress Box');

    // ── 1. Demo tag ──
    let demoTag = (await base44.asServiceRole.entities.Tag.filter({ name: DEMO_TAG }))[0];
    if (!demoTag) {
      demoTag = await base44.asServiceRole.entities.Tag.create({ name: DEMO_TAG, color: '#a855f7', description: 'Broker-demo sample data — excluded from syncs, briefings, and analytics.' });
    }

    // ── 2. Broker: Horizon Benefits Group (Alex Morgan) ──
    const brokerToken = makeToken('bp');
    const lastSept = (() => { const y = now.getFullYear(); const s = new Date(y, 8, 1); if (s > now) s.setFullYear(y - 1); return s.toISOString().split('T')[0]; })();
    const broker = await base44.asServiceRole.entities.ReferralPartner.create({
      name: 'Alex Morgan', email: 'alex.morgan@example.com', company: 'Horizon Benefits Group',
      phone: '(555) 200-1000', tier: 'Tier 1', renewal_cohort: 'Jan 1', unique_portal_id: brokerToken,
      agreement_signed_date: lastSept, commission_tiers: STANDARD_COMMISSION_TIERS,
      ytd_revenue: 48500, total_commissions_paid: 2450, is_active: true, partner_status: 'Active Partner',
      referral_count: 4, last_touchpoint_date: dateAt(-8), last_contacted_date: dateAt(-8),
      owner: 'Heather', tags: [DEMO_TAG], notes: 'Demo broker partner for the broker-demo environment.', is_demo: true,
    });

    // ── 3. Three referred clients (sales showcase) ──
    const lakesideToken = makeToken('cp');
    const brightpathToken = makeToken('cp');
    const meridianToken = makeToken('cp');

    const [lakeside, brightpath, meridian] = (await base44.asServiceRole.entities.Client.bulkCreate([
      {
        name: 'Dana Whitfield', email: 'dana.whitfield@example.com', email_domain: getOrgDomain('dana.whitfield@example.com'), company: 'Lakeside Manufacturing',
        phone: '(555) 300-2000', title: 'HR Director', industry: 'Manufacturing', company_size: '201-500', employee_count: 280,
        company_address: '1450 Industrial Pkwy, Cleveland, OH', referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
        portal_token: lakesideToken, client_stage: 'program_delivery', tier: 'Tier 1', renewal_cohort: 'Jan 1', plan_year_start: dateAt(-335),
        last_touchpoint_date: dateAt(-20), last_service_date: dateAt(-35), last_contacted_date: dateAt(-20),
        owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
      },
      {
        name: 'Marcus Bell', email: 'marcus.bell@example.com', email_domain: getOrgDomain('marcus.bell@example.com'), company: 'Brightpath Credit Union',
        phone: '(555) 400-3000', title: 'Benefits Manager', industry: 'Financial Services', company_size: '51-200', employee_count: 95,
        company_address: '88 Finance Blvd, Austin, TX', referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
        portal_token: brightpathToken, client_stage: 'program_delivery', tier: 'Tier 2', renewal_cohort: 'July 1', plan_year_start: dateAt(-110),
        last_touchpoint_date: dateAt(-12), last_service_date: dateAt(-18), last_contacted_date: dateAt(-12),
        owner: 'William', tags: [DEMO_TAG], is_demo: true,
      },
      {
        name: 'Priya Nair', email: 'priya.nair@example.com', email_domain: getOrgDomain('priya.nair@example.com'), company: 'Meridian Health Group',
        phone: '(555) 500-4000', title: 'VP People & Culture', industry: 'Healthcare', company_size: '501-1000', employee_count: 520,
        company_address: '920 Wellness Way, Phoenix, AZ', referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
        portal_token: meridianToken, client_stage: 'new_client_setup', tier: 'Tier 1', renewal_cohort: 'Jan 1', plan_year_start: dateAt(-10),
        last_touchpoint_date: dateAt(-7), last_service_date: dateAt(-7), last_contacted_date: dateAt(-7),
        owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
      },
    ]));

    // ── 4. Proposals (all accepted) ──
    const [lakesideProposal, brightpathProposal, meridianProposal] = (await base44.asServiceRole.entities.Proposal.bulkCreate([
      {
        client_id: lakeside.id, client_name: lakeside.name, client_email: lakeside.email, company: lakeside.company,
        total_amount: 18000, matched_stage: 'Stage 4 — Resilience', status: 'accepted', sent_date: isoAt(-335, 14), viewed_date: isoAt(-333, 10),
        selections: { workshops: ['beyond_burnout', 'compassion_in_crisis', 'navigating_holiday_stress', 'stress_less'], challengePrograms: ['mental_fitness_14', 'resilience_reset'], leadership: ['leading_under_pressure'], wellnessBoxes: ['reduce_stress', 'relaxation_sleep'] }, is_demo: true,
      },
      {
        client_id: brightpath.id, client_name: brightpath.name, client_email: brightpath.email, company: brightpath.company,
        total_amount: 6500, matched_stage: 'Stage 2 — Habit', status: 'accepted', sent_date: isoAt(-108, 14), viewed_date: isoAt(-106, 10),
        selections: { workshops: ['beyond_burnout', 'stress_less'], challengePrograms: ['mental_fitness_14'], wellnessBoxes: ['reduce_stress'] }, is_demo: true,
      },
      {
        client_id: meridian.id, client_name: meridian.name, client_email: meridian.email, company: meridian.company,
        total_amount: 24000, matched_stage: 'Stage 4 — Resilience', status: 'accepted', sent_date: isoAt(-12, 14), viewed_date: isoAt(-11, 10),
        selections: { workshops: ['beyond_burnout', 'compassion_in_crisis', 'stress_less', 'navigating_holiday_stress'], challengePrograms: ['mental_fitness_14', 'resilience_reset'], leadership: ['leading_under_pressure'], wellnessBoxes: ['reduce_stress', 'relaxation_sleep', 'large_emotional_wellness'] }, is_demo: true,
      },
    ]));

    // ── 5. Invoices (paid history + open first invoices) ──
    function invLine(svcInfo, description, rate, qty) {
      return { description, quantity: qty, rate, amount: rate * qty, quickbooks_item_id: svcInfo ? svcInfo.qbItem : undefined, service_id: svcInfo ? svcInfo.id : undefined };
    }
    function invoice(client, proposalId, number, amount, status, issueDaysOffset, svcInfo, memo) {
      const line = invLine(svcInfo, (svcInfo && svcInfo.name) || 'Wellness program delivery', amount, 1);
      const issue = dateAt(issueDaysOffset);
      const due = dateAt(issueDaysOffset + 30);
      return {
        invoice_number: number, client_id: client.id, client_name: client.name, client_email: client.email, company: client.company,
        proposal_id: proposalId, line_items: [line], subtotal: amount, tax_rate: 0, tax_amount: 0, total_amount: amount,
        status, issue_date: issue, due_date: due,
        paid_date: status === 'paid' ? dateAt(issueDaysOffset + randInt(10, 25)) : undefined,
        notes: 'Demo invoice — not synced to QuickBooks.', memo, is_demo: true,
      };
    }
    const invoiceRecords = [
      invoice(lakeside, lakesideProposal.id, 'INV-DEMO-1001', 5000, 'paid', -320, workshopSvc, 'Beyond Burnout series — phase 1'),
      invoice(lakeside, lakesideProposal.id, 'INV-DEMO-1002', 4500, 'paid', -240, challengeSvc, '14-Day Mental Fitness Challenge'),
      invoice(lakeside, lakesideProposal.id, 'INV-DEMO-1003', 4500, 'paid', -160, leadershipSvc, 'Leading Under Pressure leadership track'),
      invoice(lakeside, lakesideProposal.id, 'INV-DEMO-1004', 4000, 'paid', -40, boxSvc, 'Wellness Box distribution + refresher'),
      invoice(brightpath, brightpathProposal.id, 'INV-DEMO-2001', 2500, 'paid', -95, workshopSvc, 'Beyond Burnout workshop'),
      invoice(brightpath, brightpathProposal.id, 'INV-DEMO-2002', 2000, 'paid', -30, challengeSvc, '14-Day Challenge — first cohort'),
      invoice(brightpath, brightpathProposal.id, 'INV-DEMO-2003', 2000, 'sent', -5, workshopSvc, 'Stress Less workshop — open'),
      invoice(meridian, meridianProposal.id, 'INV-DEMO-3001', 12000, 'sent', -6, workshopSvc, 'Annual program — first invoice (open)'),
    ];
    await base44.asServiceRole.entities.Invoice.bulkCreate(invoiceRecords);

    // ── 6. Calendar events (specs grouped per client) ──
    // Each spec: { rec, client, serviceInfo, label, completed, feedbackCount, daysOffset }
    const eventSpecs = [];
    function addEvent(client, proposalId, daysOffset, hour, dur, type, title, completed, serviceInfo, feedbackCount, label) {
      eventSpecs.push({ rec: eventRecord(client, proposalId, daysOffset, hour, dur, type, title, completed, serviceInfo), client, serviceInfo, label, completed, feedbackCount, daysOffset });
    }
    // Lakeside — full year of delivery, 6 delivered + 1 upcoming
    addEvent(lakeside, lakesideProposal.id, -322, 10, 1.5, 'workshop', 'Beyond Burnout Workshop', true, workshopSvc, 6, 'Q1 Beyond Burnout');
    addEvent(lakeside, lakesideProposal.id, -290, 10, 1, 'challenge', '14-Day Mental Fitness Challenge — Kickoff', true, challengeSvc, 5, 'Q1 Challenge Kickoff');
    addEvent(lakeside, lakesideProposal.id, -255, 14, 1.5, 'workshop', 'Compassion in Crisis Workshop', true, workshopSvc, 5, 'Q2 Compassion in Crisis');
    addEvent(lakeside, lakesideProposal.id, -200, 10, 2, 'leadership', 'Leading Under Pressure — Session 1', true, leadershipSvc, 4, 'Q2 Leadership');
    addEvent(lakeside, lakesideProposal.id, -120, 10, 1.5, 'workshop', 'Stress Less Workshop', true, workshopSvc, 5, 'Q3 Stress Less');
    addEvent(lakeside, lakesideProposal.id, -35, 10, 1.5, 'workshop', 'Beyond Burnout — Refresher', true, workshopSvc, 5, 'Q3 Refresher');
    addEvent(lakeside, lakesideProposal.id, 28, 10, 1.5, 'workshop', 'Navigating Holiday Stress Workshop (Upcoming)', false, workshopSvc, 0, 'Q4 Holiday Stress');
    // Brightpath — mid-journey, 2 delivered + 2 upcoming
    addEvent(brightpath, brightpathProposal.id, -95, 10, 1.5, 'workshop', 'Beyond Burnout Workshop', true, workshopSvc, 6, 'Kickoff Workshop');
    addEvent(brightpath, brightpathProposal.id, -30, 10, 1, 'challenge', '14-Day Mental Fitness Challenge — Kickoff', true, challengeSvc, 4, 'Challenge Kickoff');
    addEvent(brightpath, brightpathProposal.id, 18, 10, 1.5, 'workshop', 'Stress Less Workshop (Upcoming)', false, workshopSvc, 0, 'Stress Less (upcoming)');
    addEvent(brightpath, brightpathProposal.id, 45, 10, 1, 'challenge', 'Resilience Reset Challenge — Kickoff (Upcoming)', false, challengeSvc, 0, 'Resilience Reset (upcoming)');
    // Meridian — just converted, 1 delivered last week + 2 upcoming
    addEvent(meridian, meridianProposal.id, -7, 10, 1.5, 'workshop', 'Beyond Burnout Workshop', true, workshopSvc, 6, 'First Workshop');
    addEvent(meridian, meridianProposal.id, 14, 10, 1.5, 'workshop', 'Compassion in Crisis Workshop (Upcoming)', false, workshopSvc, 0, 'Compassion in Crisis (upcoming)');
    addEvent(meridian, meridianProposal.id, 40, 10, 1, 'challenge', '14-Day Mental Fitness Challenge — Kickoff (Upcoming)', false, challengeSvc, 0, 'Challenge Kickoff (upcoming)');

    const createdEvents = await base44.asServiceRole.entities.CalendarEvent.bulkCreate(eventSpecs.map(s => s.rec));
    const eventsWithSpecs = createdEvents.map((ev, i) => ({ event: ev, spec: eventSpecs[i] }));

    // ── 7. EventCheckins (12-18 per delivered event) ──
    const lakesidePool = pool('lakeside', 44);
    const brightpathPool = pool('brightpath', 30);
    const meridianPool = pool('meridian', 24);
    const poolFor = (c) => (c === lakeside ? lakesidePool : c === brightpath ? brightpathPool : meridianPool);

    const checkinRecords = [];
    for (const { event, spec } of eventsWithSpecs) {
      if (!spec.completed) continue;
      const attendees = sampleN(poolFor(spec.client), randInt(12, 18));
      const start = new Date(event.start_date);
      for (const p of attendees) {
        const t = new Date(start.getTime() + randInt(0, 30) * 60000);
        checkinRecords.push({ event_id: event.id, client_id: spec.client.id, name: p.name, email: p.email, checked_in_at: t.toISOString(), is_demo: true });
      }
    }
    if (checkinRecords.length) await base44.asServiceRole.entities.EventCheckin.bulkCreate(checkinRecords);

    // ── 8. Cohort assessments (full plan-year arc, all 5 instruments) ──
    const cohortRecords = [];

    // Lakeside — 8 named participants, full arc: cohort_start (5) → session_check (who5) → cohort_end (5) → cohort_1mo (5, 6 of 8)
    (function lakesideCohort() {
      const named = lakesidePool.slice(0, 8);
      for (const p of named) {
        const tj = trajectory();
        cohortRecords.push(...phaseRecords(lakeside.id, lakesideProposal.id, undefined, p, 'cohort_start', ALL_INSTRUMENTS, tj.baseline, isoAt(-330, 9)));
        cohortRecords.push(...phaseRecords(lakeside.id, lakesideProposal.id, undefined, p, 'session_check', ['who5'], tj.mid, isoAt(-180, 11)));
        cohortRecords.push(...phaseRecords(lakeside.id, lakesideProposal.id, undefined, p, 'cohort_end', ALL_INSTRUMENTS, tj.end, isoAt(-35, 10)));
      }
      const month1Cohort = named.slice(0, 6);
      for (const p of month1Cohort) {
        const tj = trajectory();
        cohortRecords.push(...phaseRecords(lakeside.id, lakesideProposal.id, undefined, p, 'cohort_1mo', ALL_INSTRUMENTS, tj.month1, isoAt(-5, 10)));
      }
    })();

    // Brightpath — 6 named participants: cohort_start (5) → session_check (who5, 3 of 6) → challenge_day0 (7) / day14 (2)
    (function brightpathCohort() {
      const named = brightpathPool.slice(0, 6);
      for (const p of named) {
        const tj = trajectory();
        cohortRecords.push(...phaseRecords(brightpath.id, brightpathProposal.id, undefined, p, 'cohort_start', ALL_INSTRUMENTS, tj.baseline, isoAt(-105, 9)));
      }
      for (const p of named.slice(0, 3)) {
        const tj = trajectory();
        cohortRecords.push(...phaseRecords(brightpath.id, brightpathProposal.id, undefined, p, 'session_check', ['who5'], tj.mid, isoAt(-50, 11)));
      }
      const challenge = brightpathPool.slice(0, 7);
      for (const p of challenge) {
        const tj = trajectory();
        cohortRecords.push(who5Record(brightpath.id, brightpathProposal.id, challengeSvc.id, p, 'challenge_day0', tj.baseline.who5, isoAt(-9, 10)));
      }
      for (const p of challenge.slice(0, 2)) {
        const tj = trajectory();
        cohortRecords.push(who5Record(brightpath.id, brightpathProposal.id, challengeSvc.id, p, 'challenge_day14', tj.end.who5, isoAt(-2, 10)));
      }
    })();

    // Meridian — just converted: cohort_start (5 participants, submitted this week)
    (function meridianCohort() {
      const named = meridianPool.slice(0, 5);
      for (const p of named) {
        const tj = trajectory();
        cohortRecords.push(...phaseRecords(meridian.id, meridianProposal.id, undefined, p, 'cohort_start', ALL_INSTRUMENTS, tj.baseline, isoAt(-4, 9)));
      }
    })();

    if (cohortRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(cohortRecords);

    // ── 9. Pulse FeedbackResponses across delivered events ──
    const feedbackRecords = [];
    const biasFor = (c) => (c === lakeside ? 'high' : c === brightpath ? 'mid' : 'early');
    for (const { event, spec } of eventsWithSpecs) {
      if (!spec.completed || spec.feedbackCount === 0) continue;
      const attendees = sampleN(poolFor(spec.client), spec.feedbackCount);
      for (const p of attendees) {
        const submitted = isoAt(spec.daysOffset + randInt(1, 3), randInt(9, 16));
        feedbackRecords.push({
          service_id: spec.serviceInfo ? spec.serviceInfo.id : undefined, service_name: spec.serviceInfo ? spec.serviceInfo.name : 'Workshop', service_category: spec.serviceInfo ? spec.serviceInfo.category : 'workshop',
          client_id: spec.client.id, event_id: event.id, event_label: spec.label,
          full_name: p.name, attendee_name: p.name, attendee_email: p.email, company_name: spec.client.company, email_address: p.email,
          submitted_at: submitted, presenter: 'Jordan Lee', delivery_format: event.delivery_format,
          behavior_intent: Math.random() < 0.85 ? pick(BEHAVIOR_INTENTS) : undefined,
          fit_confidence: randInt(7, 9), expected_impact: pickN(IMPACT_OPTIONS, randInt(1, 3)),
          overall_rating: Math.random() < 0.7 ? 5 : (Math.random() < 0.6 ? 4 : 3),
          nps_score: genNps(biasFor(spec.client)), biggest_takeaway: pick(TAKEAWAYS), is_demo: true,
        });
      }
    }
    if (feedbackRecords.length) await base44.asServiceRole.entities.FeedbackResponse.bulkCreate(feedbackRecords);

    // ── 10. ClientTasks in varied states ──
    function task(client, proposalId, order, desc, status, dueOffset, completedOffset) {
      return {
        client_id: client.id, client_name: client.name, proposal_id: proposalId, description: desc, task_order: order, status,
        due_date: dateAt(dueOffset), completed_date: status === 'completed' ? isoAt(completedOffset, 15) : undefined,
        auto_generated: true, source_event: 'demo seed', notes: 'Demo task for delivery checklist.', is_demo: true,
      };
    }
    const taskRecords = [
      task(lakeside, lakesideProposal.id, 1, 'Schedule discovery call with Dana', 'completed', -330, -332),
      task(lakeside, lakesideProposal.id, 2, 'Send annual program proposal', 'completed', -335, -335),
      task(lakeside, lakesideProposal.id, 3, 'Book Beyond Burnout workshop', 'completed', -322, -322),
      task(lakeside, lakesideProposal.id, 4, 'Collect baseline cohort assessments', 'completed', -330, -328),
      task(lakeside, lakesideProposal.id, 5, 'Schedule mid-year review session', 'pending', 14, null),
      task(brightpath, brightpathProposal.id, 1, 'Send program proposal', 'completed', -108, -108),
      task(brightpath, brightpathProposal.id, 2, 'Book kickoff workshop', 'completed', -95, -95),
      task(brightpath, brightpathProposal.id, 3, 'Mid-year check-in with Marcus', 'pending', 7, null),
      task(meridian, meridianProposal.id, 1, 'Send proposal', 'completed', -12, -12),
      task(meridian, meridianProposal.id, 2, 'Welcome onboarding call', 'pending', 3, null),
    ];
    await base44.asServiceRole.entities.ClientTask.bulkCreate(taskRecords);

    // ── 11. Cascade Dental Partners — pending referral (in the pipeline) ──
    const cascadeLead = await base44.asServiceRole.entities.Lead.create({
      name: 'Renee Okafor', email: 'renee.okafor@example.com', company: 'Cascade Dental Partners',
      industry: 'Healthcare', company_size: '51-200', lead_type: 'broker_lead', status: 'cold',
      source: 'Referral from Alex Morgan', owner: 'William', tags: [DEMO_TAG], is_demo: true,
    });

    // ── 12. Referrals (3 placed + 1 pending) ──
    const [lakesideReferral, brightpathReferral, meridianReferral, cascadeReferral] = (await base44.asServiceRole.entities.Referral.bulkCreate([
      { referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Dana Whitfield', contact_email: 'dana.whitfield@example.com', company_name: 'Lakeside Manufacturing', referred_client_id: lakeside.id, proposal_id: lakesideProposal.id, referral_date: isoAt(-330, 13), status: 'commission_paid', first_year_revenue: 18000, commission_rate: 0.10, commission_amount: 1800, brokerage_commission: 0, broker_commission: 1800, notes: 'Strong manufacturing client — full annual program. Commission paid.', is_demo: true },
      { referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Marcus Bell', contact_email: 'marcus.bell@example.com', company_name: 'Brightpath Credit Union', referred_client_id: brightpath.id, proposal_id: brightpathProposal.id, referral_date: isoAt(-100, 13), status: 'purchased', first_year_revenue: 6500, commission_rate: 0.10, commission_amount: 650, brokerage_commission: 0, broker_commission: 650, notes: 'Credit union — mid-size program. Commission paid.', is_demo: true },
      { referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Priya Nair', contact_email: 'priya.nair@example.com', company_name: 'Meridian Health Group', referred_client_id: meridian.id, proposal_id: meridianProposal.id, referral_date: isoAt(-12, 13), status: 'converted_to_client', first_year_revenue: 24000, commission_rate: 0.10, commission_amount: 2400, brokerage_commission: 0, broker_commission: 2400, notes: 'Large healthcare group — commission pending until first invoice is paid.', is_demo: true },
      { referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Renee Okafor', contact_email: 'renee.okafor@example.com', company_name: 'Cascade Dental Partners', referred_lead_id: cascadeLead.id, referral_date: isoAt(-4, 13), status: 'pending_review', first_year_revenue: 0, commission_rate: 0.10, commission_amount: 0, notes: 'New referral — awaiting review and outreach.', is_demo: true },
    ]));

    // ── 13. Referral activities (the story over months) ──
    const salesActivities = [
      { referral_id: lakesideReferral.id, message: 'Alex Morgan submitted a referral for Lakeside Manufacturing (Dana Whitfield).', activity_date: isoAt(-330, 13) },
      { referral_id: lakesideReferral.id, message: 'Lakeside Manufacturing contacted — discovery call scheduled with Dana.', activity_date: isoAt(-322, 10) },
      { referral_id: lakesideReferral.id, message: 'Lakeside Manufacturing converted to client. Proposal accepted ($18,000).', activity_date: isoAt(-318, 14) },
      { referral_id: lakesideReferral.id, message: 'Lakeside Manufacturing purchase recorded. First-year revenue: $18,000.', activity_date: isoAt(-315, 11) },
      { referral_id: lakesideReferral.id, message: 'Commission paid to Alex Morgan for Lakeside Manufacturing ($1,800 at 10%).', activity_date: isoAt(-300, 12), activity_type: 'commission_payment', amount: 1800 },
      { referral_id: brightpathReferral.id, message: 'Alex Morgan submitted a referral for Brightpath Credit Union (Marcus Bell).', activity_date: isoAt(-100, 13) },
      { referral_id: brightpathReferral.id, message: 'Brightpath Credit Union contacted and discovery call completed.', activity_date: isoAt(-95, 10) },
      { referral_id: brightpathReferral.id, message: 'Brightpath Credit Union purchased. First-year revenue: $6,500.', activity_date: isoAt(-90, 11) },
      { referral_id: brightpathReferral.id, message: 'Commission paid for Brightpath Credit Union ($650 at 10%).', activity_date: isoAt(-85, 12), activity_type: 'commission_payment', amount: 650 },
      { referral_id: meridianReferral.id, message: 'Alex Morgan submitted a referral for Meridian Health Group (Priya Nair).', activity_date: isoAt(-12, 13) },
      { referral_id: meridianReferral.id, message: 'Meridian Health Group converted to client. Proposal accepted ($24,000). Commission pending until first invoice is paid.', activity_date: isoAt(-8, 11) },
      { referral_id: cascadeReferral.id, message: 'Alex Morgan submitted a referral for Cascade Dental Partners (Renee Okafor). Awaiting review and outreach.', activity_date: isoAt(-4, 13) },
      { referral_id: cascadeReferral.id, message: 'Cascade Dental Partners — discovery call being scheduled.', activity_date: isoAt(-1, 10) },
    ].map(a => Object.assign({ activity_type: 'note' }, a, { referral_partner_id: broker.id, is_demo: true }));
    await base44.asServiceRole.entities.ReferralActivity.bulkCreate(salesActivities);

    // ── 14. MFS demo (preserved untouched — Harborview, Brightwater, Cedar) ──
    function noiseItem(center, min, max) {
      let v = Math.round(center + (Math.random() * 2 - 1));
      return Math.min(max, Math.max(min, v));
    }
    function generateMfsResponses(clientId, count, centers, daysBack) {
      const records = [];
      for (let i = 0; i < count; i++) {
        const sid = `mfs-demo-${crypto.randomUUID()}`;
        const submittedAt = isoAt(-randInt(1, daysBack), randInt(8, 17));
        const who5Resp = { q1: noiseItem(centers.who5, 0, 5), q2: noiseItem(centers.who5, 0, 5), q3: noiseItem(centers.who5, 0, 5), q4: noiseItem(centers.who5, 0, 5), q5: noiseItem(centers.who5, 0, 5) };
        const pss4Resp = { q1: noiseItem(centers.pss4, 0, 4), q2: noiseItem(centers.pss4, 0, 4), q3: noiseItem(centers.pss4, 0, 4), q4: noiseItem(centers.pss4, 0, 4) };
        const uwes3Resp = { q1: noiseItem(centers.uwes3, 0, 6), q2: noiseItem(centers.uwes3, 0, 6), q3: noiseItem(centers.uwes3, 0, 6) };
        const ucla3Resp = { q1: noiseItem(centers.ucla3, 0, 3), q2: noiseItem(centers.ucla3, 0, 3), q3: noiseItem(centers.ucla3, 0, 3) };
        for (const [key, resp] of [['who5', who5Resp], ['pss4', pss4Resp], ['uwes3', uwes3Resp], ['ucla3', ucla3Resp]]) {
          const raw = Object.values(resp).reduce((s, v) => s + (v || 0), 0);
          const record = {
            client_id: clientId, survey_type: 'mfs', instrument: key,
            participant_email: '', instrument_subscores: { _sid: sid },
            instrument_total: raw, item_responses: resp,
            cohort_year: new Date(submittedAt).getFullYear(), submitted_at: submittedAt, is_demo: true,
          };
          if (key === 'who5') {
            record.who5_cheerful = resp.q1; record.who5_calm = resp.q2; record.who5_active = resp.q3;
            record.who5_rested = resp.q4; record.who5_interested = resp.q5; record.who5_total = raw * 4;
          }
          records.push(record);
        }
      }
      return records;
    }

    const mfsToken = makeToken('mfs');
    const harborviewClient = await base44.asServiceRole.entities.Client.create({
      name: 'Jordan Reeves', email: 'jordan.reeves@harborview-demo.com', email_domain: getOrgDomain('jordan.reeves@harborview-demo.com'), company: 'Harborview Logistics',
      phone: '(555) 600-7000', title: 'VP of People', industry: 'Logistics', company_size: '51-200', employee_count: 140,
      company_address: '2200 Harbor Blvd, Long Beach, CA', client_stage: 'event_follow_up',
      is_assessment_lead: true, referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
      owner: 'William', tags: [DEMO_TAG], is_demo: true,
    });
    const harborviewLead = await base44.asServiceRole.entities.Lead.create({
      name: 'Jordan Reeves', email: 'jordan.reeves@harborview-demo.com', company: 'Harborview Logistics',
      industry: 'Logistics', company_size: '51-200', lead_type: 'company_inquiry', status: 'cold',
      source: `Mental Fitness Score (${brokerToken})`, converted_client_id: harborviewClient.id,
      owner: 'William', tags: [DEMO_TAG], is_demo: true,
    });
    const harborviewAssessment = await base44.asServiceRole.entities.MfsAssessment.create({
      token: mfsToken, status: 'ready', client_id: harborviewClient.id, lead_id: harborviewLead.id,
      company_name: 'Harborview Logistics', contact_name: 'Jordan Reeves',
      contact_email: 'jordan.reeves@harborview-demo.com', employee_count: '51-200', industry: 'Logistics',
      goals: ['Burnout & stress', 'Team connection'], ref: brokerToken, is_demo: true,
    });
    const harborviewMfsRecords = generateMfsResponses(harborviewClient.id, 45, { who5: 3.3, pss4: 1.5, uwes3: 4.2, ucla3: 2.13 }, 14);
    if (harborviewMfsRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(harborviewMfsRecords);
    const harborviewMfsReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Jordan Reeves',
      contact_email: 'jordan.reeves@harborview-demo.com', company_name: 'Harborview Logistics',
      referred_lead_id: harborviewLead.id, referred_client_id: harborviewClient.id,
      referral_date: isoAt(-15, 13), status: 'pending_review', first_year_revenue: 0,
      commission_rate: 0.10, commission_amount: 0, notes: 'MFS assessment lead — 45 responses, dashboard ready.', is_demo: true,
    });

    const brightwaterMfsToken = makeToken('mfs');
    const brightwaterMfsClient = await base44.asServiceRole.entities.Client.create({
      name: 'Dr. Emily Chen', email: 'emily.chen@brightwater-demo.com', email_domain: getOrgDomain('emily.chen@brightwater-demo.com'), company: 'Brightwater Dental Group',
      phone: '(555) 600-8000', title: 'Practice Owner', industry: 'Healthcare', company_size: '1-50', employee_count: 35,
      company_address: '450 Smiles Ave, Sacramento, CA', client_stage: 'event_follow_up',
      is_assessment_lead: true, referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
      owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
    });
    const brightwaterMfsLead = await base44.asServiceRole.entities.Lead.create({
      name: 'Dr. Emily Chen', email: 'emily.chen@brightwater-demo.com', company: 'Brightwater Dental Group',
      industry: 'Healthcare', company_size: '1-50', lead_type: 'company_inquiry', status: 'cold',
      source: `Mental Fitness Score (${brokerToken})`, converted_client_id: brightwaterMfsClient.id,
      owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
    });
    const brightwaterAssessment = await base44.asServiceRole.entities.MfsAssessment.create({
      token: brightwaterMfsToken, status: 'collecting', client_id: brightwaterMfsClient.id, lead_id: brightwaterMfsLead.id,
      company_name: 'Brightwater Dental Group', contact_name: 'Dr. Emily Chen',
      contact_email: 'emily.chen@brightwater-demo.com', employee_count: '1-50', industry: 'Healthcare',
      goals: ['Burnout & stress', 'Team connection'], ref: brokerToken, is_demo: true,
    });
    const brightwaterMfsRecords = generateMfsResponses(brightwaterMfsClient.id, 3, { who5: 3.0, pss4: 1.8, uwes3: 4.0, ucla3: 2.0 }, 5);
    if (brightwaterMfsRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(brightwaterMfsRecords);
    const brightwaterMfsReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Dr. Emily Chen',
      contact_email: 'emily.chen@brightwater-demo.com', company_name: 'Brightwater Dental Group',
      referred_lead_id: brightwaterMfsLead.id, referred_client_id: brightwaterMfsClient.id,
      referral_date: isoAt(-5, 13), status: 'pending_review', first_year_revenue: 0,
      commission_rate: 0.10, commission_amount: 0, notes: 'MFS assessment lead — 3 responses, privacy gate active.', is_demo: true,
    });

    const cedarToken = makeToken('mfs');
    const cedarClient = await base44.asServiceRole.entities.Client.create({
      name: 'Maria Santos', email: 'maria.santos@cedarvine-demo.com', email_domain: getOrgDomain('maria.santos@cedarvine-demo.com'), company: 'Cedar & Vine Hospitality',
      phone: '(555) 600-9000', title: 'Director of People & Culture', industry: 'Hospitality', company_size: '51-200', employee_count: 85,
      company_address: '1200 Vineyard Rd, Napa, CA', client_stage: 'event_follow_up',
      is_assessment_lead: true, referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
      owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
    });
    const cedarLead = await base44.asServiceRole.entities.Lead.create({
      name: 'Maria Santos', email: 'maria.santos@cedarvine-demo.com', company: 'Cedar & Vine Hospitality',
      industry: 'Hospitality', company_size: '51-200', lead_type: 'company_inquiry', status: 'cold',
      source: `Mental Fitness Score (${brokerToken})`, converted_client_id: cedarClient.id,
      owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
    });
    const cedarAssessment = await base44.asServiceRole.entities.MfsAssessment.create({
      token: cedarToken, status: 'ready', client_id: cedarClient.id, lead_id: cedarLead.id,
      company_name: 'Cedar & Vine Hospitality', contact_name: 'Maria Santos',
      contact_email: 'maria.santos@cedarvine-demo.com', employee_count: '51-200', industry: 'Hospitality',
      goals: ['Retention', 'Engagement'], ref: brokerToken, is_demo: true,
    });
    const cedarMfsRecords = generateMfsResponses(cedarClient.id, 28, { who5: 3.3, pss4: 1.5, uwes3: 4.5, ucla3: 1.6 }, 10);
    if (cedarMfsRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(cedarMfsRecords);
    const cedarMfsReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Maria Santos',
      contact_email: 'maria.santos@cedarvine-demo.com', company_name: 'Cedar & Vine Hospitality',
      referred_lead_id: cedarLead.id, referred_client_id: cedarClient.id,
      referral_date: isoAt(-10, 13), status: 'pending_review', first_year_revenue: 0,
      commission_rate: 0.10, commission_amount: 0, notes: 'MFS assessment lead — 28 responses, dashboard ready.', is_demo: true,
    });

    const mfsActivities = [
      { referral_id: harborviewMfsReferral.id, message: 'Alex Morgan shared the Mental Fitness Score link. Harborview Logistics submitted an intake (140 employees, logistics).', activity_date: isoAt(-15, 13) },
      { referral_id: harborviewMfsReferral.id, message: 'Harborview Logistics MFS dashboard is ready — 45 employee responses collected. Composite score: ~61 (Connection notably lowest).', activity_date: isoAt(-3, 10) },
      { referral_id: brightwaterMfsReferral.id, message: 'Alex Morgan shared the Mental Fitness Score link. Brightwater Dental Group submitted an intake (35 employees, healthcare).', activity_date: isoAt(-5, 13) },
      { referral_id: brightwaterMfsReferral.id, message: 'Brightwater Dental Group is collecting responses — 3 of 5 so far (privacy gate active).', activity_date: isoAt(-1, 10) },
      { referral_id: cedarMfsReferral.id, message: 'Alex Morgan shared the Mental Fitness Score link. Cedar & Vine Hospitality submitted an intake (85 employees, hospitality).', activity_date: isoAt(-10, 13) },
      { referral_id: cedarMfsReferral.id, message: 'Cedar & Vine Hospitality MFS dashboard is ready — 28 employee responses collected. Composite score: ~68 (Engagement strongest, a healthier team).', activity_date: isoAt(-2, 10) },
    ].map(a => Object.assign({ activity_type: 'note' }, a, { referral_partner_id: broker.id, is_demo: true }));
    await base44.asServiceRole.entities.ReferralActivity.bulkCreate(mfsActivities);

    const salesCohortCount = cohortRecords.length;
    const mfsCohortCount = harborviewMfsRecords.length + brightwaterMfsRecords.length + cedarMfsRecords.length;

    return Response.json({
      success: true,
      broker_portal_link: origin + '/ReferralPortal?id=' + brokerToken,
      client_portal_links: [
        { company: 'Lakeside Manufacturing', link: origin + '/ClientPortal?token=' + lakesideToken },
        { company: 'Brightpath Credit Union', link: origin + '/ClientPortal?token=' + brightpathToken },
        { company: 'Meridian Health Group', link: origin + '/ClientPortal?token=' + meridianToken },
      ],
      mfs_links: [
        { company: 'Harborview Logistics', survey_link: origin + '/MfsSurvey?t=' + mfsToken, results_link: origin + '/MfsResults?t=' + mfsToken },
        { company: 'Cedar & Vine Hospitality', survey_link: origin + '/MfsSurvey?t=' + cedarToken, results_link: origin + '/MfsResults?t=' + cedarToken },
        { company: 'Brightwater Dental Group', survey_link: origin + '/MfsSurvey?t=' + brightwaterMfsToken, results_link: origin + '/MfsResults?t=' + brightwaterMfsToken },
      ],
      counts: {
        referral_partners: 1,
        clients: 6,
        leads: 4,
        proposals: 3,
        invoices: invoiceRecords.length,
        calendar_events: createdEvents.length,
        event_checkins: checkinRecords.length,
        feedback_responses: feedbackRecords.length,
        cohort_assessments: salesCohortCount + mfsCohortCount,
        client_tasks: taskRecords.length,
        referrals: 7,
        referral_activities: salesActivities.length + mfsActivities.length,
        mfs_assessments: 3,
        mfs_responses: 76,
      },
    });
  } catch (error) {
    console.error('seedDemoData error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});