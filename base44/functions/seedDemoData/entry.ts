import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getOrgDomain } from '../../shared/emailDomain.ts';

const DEMO_TAG = 'Demo';

const STANDARD_COMMISSION_TIERS = [
  { min_revenue: 0, max_revenue: 10000, rate: 0.10, label: 'Tier 1 (0-10k)' },
  { min_revenue: 10000, max_revenue: 25000, rate: 0.12, label: 'Tier 2 (10k-25k)' },
  { min_revenue: 25000, max_revenue: null, rate: 0.15, label: 'Tier 3 (25k+)' },
];

const FIRST_NAMES = ['Sarah','Michael','Jessica','David','Emily','Christopher','Amanda','Daniel','Lauren','Matthew','Rachel','Andrew','Megan','Tyler','Nicole','Brandon','Stephanie','Kevin','Ashley','Justin','Brittany','Nathan','Katherine','Ryan','Eric','Samantha','Brian','Christine','Jason','Melissa','Adam','Danielle','Laura','Sean','Greg','Vanessa'];
const LAST_NAMES = ['Carter','Bennett','Foster','Reyes','Hughes','Sullivan','Ward','Coleman','Brooks','Gray','Powell','Russell','Long','Webb','Perry','Hamilton','Graham','Wallace','Woods','Dixon','Burns','Henry','Freeman','Hicks','Knight','Shaw','Strickland','Bishop','Fleming','Manning'];

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
  'Set a hard stop at 5:30 twice a week'
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

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function pickN(a, n) { const c = [...a], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return o; }
function dateDaysAgo(d) { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().split('T')[0]; }
function isoDaysAgo(d, h) { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h || 10, 0, 0, 0); return x.toISOString(); }
function makeToken(p) { return p + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20); }
function participantPool(domain, n) { const seen = new Set(); const out = []; while (out.length < n) { const f = pick(FIRST_NAMES), l = pick(LAST_NAMES), e = (f + '.' + l + '@' + domain).toLowerCase(); if (seen.has(e)) continue; seen.add(e); out.push({ name: f + ' ' + l, email: e }); } return out; }
function genWho5(center) { const items = []; for (let i = 0; i < 5; i++) { let v = Math.round(center + (Math.random() * 2 - 1)); v = Math.min(5, Math.max(0, v)); items.push(v); } return items; }

function buildCohort(clientId, proposalId, serviceId, participant, surveyType, items, submittedAt) {
  const total = items.reduce((s, v) => s + v, 0) * 4;
  return {
    client_id: clientId, service_id: serviceId || undefined, proposal_id: proposalId,
    participant_email: participant.email, survey_type: surveyType, instrument: 'who5', instrument_total: total,
    item_responses: { q1: items[0], q2: items[1], q3: items[2], q4: items[3], q5: items[4] },
    who5_cheerful: items[0], who5_calm: items[1], who5_active: items[2], who5_rested: items[3], who5_interested: items[4],
    who5_total: total, cohort_year: new Date(submittedAt).getFullYear(), submitted_at: submittedAt, is_demo: true,
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

    // Services (reference real IDs where available)
    const services = await base44.asServiceRole.entities.Service.list('sort_order', 200);
    const svcByCat = {};
    for (const s of services) { (svcByCat[s.category] ||= []).push(s); }
    const svc = (cat, fallback) => { const s = svcByCat[cat] && svcByCat[cat][0]; return { id: s ? s.id : undefined, name: s ? s.name : fallback, category: cat }; };

    // 1. Demo tag
    let demoTag = (await base44.asServiceRole.entities.Tag.filter({ name: DEMO_TAG }))[0];
    if (!demoTag) {
      demoTag = await base44.asServiceRole.entities.Tag.create({ name: DEMO_TAG, color: '#a855f7', description: 'Broker-demo sample data — excluded from syncs, briefings, and analytics.' });
    }

    // 2. Broker: Alex Morgan
    const lastSept = (() => { const y = now.getFullYear(); const s = new Date(y, 8, 1); if (s > now) s.setFullYear(y - 1); return s.toISOString().split('T')[0]; })();
    const brokerToken = makeToken('bp');
    const broker = await base44.asServiceRole.entities.ReferralPartner.create({
      name: 'Alex Morgan', email: 'alex.morgan@example-demo.com', company: 'Morgan Benefits Group',
      phone: '(555) 200-1000', tier: 'Tier 1', renewal_cohort: 'Jan 1', unique_portal_id: brokerToken,
      agreement_signed_date: lastSept, commission_tiers: STANDARD_COMMISSION_TIERS,
      ytd_revenue: 48500, total_commissions_paid: 2450, is_active: true, partner_status: 'Active Partner',
      referral_count: 7, last_touchpoint_date: dateDaysAgo(8), last_contacted_date: dateDaysAgo(8),
      owner: 'Heather', tags: [DEMO_TAG], notes: 'Demo broker partner for the broker-demo environment.', is_demo: true,
    });

    // 3. Three referred clients (all linked to Alex, each with a portal token)
    const lakesideToken = makeToken('cp');
    const brightpathToken = makeToken('cp');
    const meridianToken = makeToken('cp');

    const lakeside = await base44.asServiceRole.entities.Client.create({
      name: 'Dana Whitfield', email: 'dana.whitfield@lakeside-demo.com', email_domain: getOrgDomain('dana.whitfield@lakeside-demo.com'), company: 'Lakeside Manufacturing',
      phone: '(555) 300-2000', title: 'HR Director', industry: 'Manufacturing', company_size: '201-500', employee_count: 280,
      company_address: '1450 Industrial Pkwy, Cleveland, OH', referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
      portal_token: lakesideToken, client_stage: 'program_delivery', tier: 'Tier 1', renewal_cohort: 'Jan 1',
      last_touchpoint_date: dateDaysAgo(20), last_service_date: dateDaysAgo(35), last_contacted_date: dateDaysAgo(20),
      owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
    });
    const brightpath = await base44.asServiceRole.entities.Client.create({
      name: 'Marcus Bell', email: 'marcus.bell@brightpath-demo.com', email_domain: getOrgDomain('marcus.bell@brightpath-demo.com'), company: 'Brightpath Credit Union',
      phone: '(555) 400-3000', title: 'Benefits Manager', industry: 'Financial Services', company_size: '51-200', employee_count: 95,
      company_address: '88 Finance Blvd, Austin, TX', referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
      portal_token: brightpathToken, client_stage: 'program_delivery', tier: 'Tier 2', renewal_cohort: 'July 1',
      last_touchpoint_date: dateDaysAgo(12), last_service_date: dateDaysAgo(18), last_contacted_date: dateDaysAgo(12),
      owner: 'William', tags: [DEMO_TAG], is_demo: true,
    });
    const meridian = await base44.asServiceRole.entities.Client.create({
      name: 'Priya Nair', email: 'priya.nair@meridian-demo.com', email_domain: getOrgDomain('priya.nair@meridian-demo.com'), company: 'Meridian Health Group',
      phone: '(555) 500-4000', title: 'VP People & Culture', industry: 'Healthcare', company_size: '501-1000', employee_count: 520,
      company_address: '920 Wellness Way, Phoenix, AZ', referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan',
      portal_token: meridianToken, client_stage: 'new_client_setup', tier: 'Tier 1', renewal_cohort: 'Jan 1',
      last_touchpoint_date: dateDaysAgo(7), last_service_date: dateDaysAgo(7), last_contacted_date: dateDaysAgo(7),
      owner: 'Heather', tags: [DEMO_TAG], is_demo: true,
    });

    // 4. Harbor Logistics lead (submitted referral, no client yet — shows an early pipeline stage)
    const harborLead = await base44.asServiceRole.entities.Lead.create({
      name: 'Tom Briggs', email: 'tom.briggs@harbor-demo.com', company: 'Harbor Logistics',
      industry: 'Logistics', company_size: '201-500', lead_type: 'broker_lead', status: 'cold',
      source: 'Referral from Alex Morgan', owner: 'William', tags: [DEMO_TAG], is_demo: true,
    });

    // 5. Proposals
    const lakesideSvc = svc('workshop', 'Beyond Burnout: From Pressure to Presence');
    const challengeSvc = svc('challenge', '14-Day Mental Fitness Challenge');
    const leadershipSvc = svc('leadership', 'Leading Under Pressure');
    const boxSvc = svc('wellness_box', 'Reduce Stress Box');

    const lakesideProposal = await base44.asServiceRole.entities.Proposal.create({
      client_id: lakeside.id, client_name: lakeside.name, client_email: lakeside.email, company: lakeside.company,
      total_amount: 18000, matched_stage: 'Stage 4 — Resilience', status: 'accepted', sent_date: isoDaysAgo(335), viewed_date: isoDaysAgo(333),
      selections: { workshops: ['beyond_burnout', 'compassion_in_crisis', 'navigating_holiday_stress', 'stress_less'], challengePrograms: ['mental_fitness_14', 'resilience_reset'], leadership: ['leading_under_pressure'], wellnessBoxes: ['reduce_stress', 'relaxation_sleep'] }, is_demo: true,
    });
    const brightpathProposal = await base44.asServiceRole.entities.Proposal.create({
      client_id: brightpath.id, client_name: brightpath.name, client_email: brightpath.email, company: brightpath.company,
      total_amount: 6500, matched_stage: 'Stage 2 — Habit', status: 'accepted', sent_date: isoDaysAgo(140), viewed_date: isoDaysAgo(138),
      selections: { workshops: ['beyond_burnout', 'stress_less'], challengePrograms: ['mental_fitness_14'], wellnessBoxes: ['reduce_stress'] }, is_demo: true,
    });
    const meridianProposal = await base44.asServiceRole.entities.Proposal.create({
      client_id: meridian.id, client_name: meridian.name, client_email: meridian.email, company: meridian.company,
      total_amount: 24000, matched_stage: 'Stage 4 — Resilience', status: 'accepted', sent_date: isoDaysAgo(42), viewed_date: isoDaysAgo(41),
      selections: { workshops: ['beyond_burnout', 'compassion_in_crisis', 'stress_less', 'navigating_holiday_stress'], challengePrograms: ['mental_fitness_14', 'resilience_reset'], leadership: ['leading_under_pressure'], wellnessBoxes: ['reduce_stress', 'relaxation_sleep', 'large_emotional_wellness'] }, is_demo: true,
    });

    // 6. Calendar events (+ feedback generation context)
    const lakesidePool = participantPool('lakeside-demo.com', 68);
    const brightpathPool = participantPool('brightpath-demo.com', 30);
    const meridianPool = participantPool('meridian-demo.com', 40);

    function proposalIdFor(client) { return client === lakeside ? lakesideProposal.id : (client === brightpath ? brightpathProposal.id : meridianProposal.id); }
    function buildEvent(client, daysOffset, eventType, title, completed, serviceInfo) {
      const start = new Date(); start.setDate(start.getDate() + daysOffset); start.setHours(10, 0, 0, 0);
      const end = new Date(start); end.setHours(end.getHours() + 1);
      return {
        title, event_type: eventType, start_date: start.toISOString(), end_date: end.toISOString(),
        client_id: client.id, client_name: client.company, service_id: serviceInfo ? serviceInfo.id : undefined,
        proposal_id: proposalIdFor(client), presenter: 'Jordan Lee', presenter_accepted: true, presenter_email: 'jordan.lee@skillfulmeans.life',
        delivery_format: Math.random() > 0.4 ? 'virtual' : 'hybrid', completed,
        completed_date: completed ? start.toISOString() : undefined, invite_sent: true, is_demo: true, ingested: false,
      };
    }

    const eventSpecs = [];
    function addEvent(client, daysOffset, eventType, title, completed, serviceInfo, feedbackCount, pool, label) {
      eventSpecs.push({ event: buildEvent(client, daysOffset, eventType, title, completed, serviceInfo), completed, feedbackCount, pool, serviceInfo, label, client });
    }

    // Lakeside — full year of delivery, all completed except one upcoming workshop next month
    addEvent(lakeside, -330, 'workshop', 'Beyond Burnout Workshop', true, lakesideSvc, 12, lakesidePool, 'Aug 2025 Workshop');
    addEvent(lakeside, -300, 'challenge', '14-Day Mental Fitness Challenge — Kickoff', true, challengeSvc, 11, lakesidePool, 'Sep 2025 Challenge');
    addEvent(lakeside, -270, 'workshop', 'Compassion in Crisis Workshop', true, lakesideSvc, 10, lakesidePool, 'Oct 2025 Workshop');
    addEvent(lakeside, -240, 'leadership', 'Leading Under Pressure — Session 1', true, leadershipSvc, 8, lakesidePool, 'Nov 2025 Leadership');
    addEvent(lakeside, -210, 'workshop', 'Navigating Holiday Stress Workshop', true, lakesideSvc, 12, lakesidePool, 'Dec 2025 Workshop');
    addEvent(lakeside, -165, 'challenge', 'Resilience Reset Challenge — Kickoff', true, challengeSvc, 11, lakesidePool, 'Feb 2026 Challenge');
    addEvent(lakeside, -120, 'workshop', 'Stress Less Workshop', true, lakesideSvc, 10, lakesidePool, 'Mar 2026 Workshop');
    addEvent(lakeside, -60, 'workshop', 'Beyond Burnout — Refresher', true, lakesideSvc, 9, lakesidePool, 'May 2026 Workshop');
    addEvent(lakeside, -35, 'class', 'Wellness Box Distribution & Mindful Movement', true, boxSvc, 6, lakesidePool, 'Jun 2026 Movement');
    addEvent(lakeside, 28, 'workshop', 'Beyond Burnout Workshop (Upcoming)', false, lakesideSvc, 0, lakesidePool, 'Aug 2026 Workshop');

    // Brightpath — mid-journey, half delivered, next challenge starting in 3 weeks
    addEvent(brightpath, -110, 'workshop', 'Beyond Burnout Workshop', true, lakesideSvc, 8, brightpathPool, 'Mar 2026 Workshop');
    addEvent(brightpath, -75, 'challenge', '14-Day Mental Fitness Challenge — Kickoff', true, challengeSvc, 7, brightpathPool, 'Apr 2026 Challenge');
    addEvent(brightpath, -20, 'workshop', 'Stress Less Workshop', true, lakesideSvc, 7, brightpathPool, 'Jun 2026 Workshop');
    addEvent(brightpath, 21, 'challenge', 'Resilience Reset Challenge — Kickoff', false, challengeSvc, 0, brightpathPool, 'Jul 2026 Challenge');

    // Meridian — recently converted, first workshop delivered last week, rest scheduled
    addEvent(meridian, -7, 'workshop', 'Beyond Burnout Workshop', true, lakesideSvc, 12, meridianPool, 'Jul 2026 Workshop');
    addEvent(meridian, 14, 'workshop', 'Compassion in Crisis Workshop', false, lakesideSvc, 0, meridianPool, 'Jul 2026 Workshop');
    addEvent(meridian, 35, 'challenge', '14-Day Mental Fitness Challenge — Kickoff', false, challengeSvc, 0, meridianPool, 'Aug 2026 Challenge');
    addEvent(meridian, 70, 'leadership', 'Leading Under Pressure — Session 1', false, leadershipSvc, 0, meridianPool, 'Sep 2026 Leadership');

    const createdEvents = await base44.asServiceRole.entities.CalendarEvent.bulkCreate(eventSpecs.map(s => s.event));

    // 7. Feedback responses (~120 across delivered sessions, weighted toward Lakeside)
    const feedbackRecords = [];
    for (const spec of eventSpecs) {
      if (!spec.completed || spec.feedbackCount === 0) continue;
      for (let i = 0; i < spec.feedbackCount; i++) {
        const p = pick(spec.pool);
        const rating = Math.random() < 0.12 ? 3 : (Math.random() < 0.6 ? 5 : 4);
        const hasIntent = Math.random() < 0.85;
        const submitted = new Date(new Date(spec.event.start_date).getTime() + randInt(1, 3) * 86400000).toISOString();
        feedbackRecords.push({
          service_id: spec.serviceInfo ? spec.serviceInfo.id : undefined, service_name: spec.serviceInfo.name, service_category: spec.serviceInfo.category,
          client_id: spec.client.id, event_label: spec.label, full_name: p.name, attendee_name: p.name, attendee_email: p.email,
          company_name: spec.client.company, email_address: p.email, submitted_at: submitted, presenter: 'Jordan Lee',
          delivery_format: spec.event.delivery_format, behavior_intent: hasIntent ? pick(BEHAVIOR_INTENTS) : undefined,
          fit_confidence: randInt(6, 9), expected_impact: pickN(IMPACT_OPTIONS, randInt(1, 3)), overall_rating: rating,
          nps_score: randInt(7, 10), biggest_takeaway: pick(TAKEAWAYS), is_demo: true,
        });
      }
    }
    if (feedbackRecords.length) await base44.asServiceRole.entities.FeedbackResponse.bulkCreate(feedbackRecords);

    // 8. Referrals (matching the clients + one early-stage)
    const lakesideReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Dana Whitfield',
      contact_email: 'dana.whitfield@lakeside-demo.com', company_name: 'Lakeside Manufacturing', referred_client_id: lakeside.id,
      proposal_id: lakesideProposal.id, referral_date: isoDaysAgo(340), status: 'commission_paid',
      first_year_revenue: 18000, commission_rate: 0.10, commission_amount: 1800, notes: 'Strong manufacturing client, full annual program.', is_demo: true,
    });
    const brightpathReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Marcus Bell',
      contact_email: 'marcus.bell@brightpath-demo.com', company_name: 'Brightpath Credit Union', referred_client_id: brightpath.id,
      proposal_id: brightpathProposal.id, referral_date: isoDaysAgo(145), status: 'purchased',
      first_year_revenue: 6500, commission_rate: 0.10, commission_amount: 650, notes: 'Credit union, mid-size program.', is_demo: true,
    });
    const meridianReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Priya Nair',
      contact_email: 'priya.nair@meridian-demo.com', company_name: 'Meridian Health Group', referred_client_id: meridian.id,
      proposal_id: meridianProposal.id, referral_date: isoDaysAgo(48), status: 'converted_to_client',
      first_year_revenue: 24000, commission_rate: 0.10, commission_amount: 2400, notes: 'Large healthcare group, commission pending until purchase finalizes.', is_demo: true,
    });
    const harborReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Tom Briggs',
      contact_email: 'tom.briggs@harbor-demo.com', company_name: 'Harbor Logistics', referred_lead_id: harborLead.id,
      referral_date: isoDaysAgo(21), status: 'submitted', first_year_revenue: 0, commission_rate: 0.10, commission_amount: 0,
      notes: 'New referral — awaiting outreach and discovery call.', is_demo: true,
    });

    // 9. Referral activities (the story over months)
    const activities = [
      { referral_id: lakesideReferral.id, message: 'Alex Morgan submitted a referral for Lakeside Manufacturing (Dana Whitfield).', activity_date: isoDaysAgo(340) },
      { referral_id: lakesideReferral.id, message: 'Lakeside Manufacturing contacted — discovery call scheduled with Dana.', activity_date: isoDaysAgo(330) },
      { referral_id: lakesideReferral.id, message: 'Lakeside Manufacturing converted to client. Proposal accepted ($18,000).', activity_date: isoDaysAgo(325) },
      { referral_id: lakesideReferral.id, message: 'Lakeside Manufacturing purchase recorded. First-year revenue: $18,000.', activity_date: isoDaysAgo(310) },
      { referral_id: lakesideReferral.id, message: 'Commission paid to Alex Morgan for Lakeside Manufacturing placement ($1,800 at 10%).', activity_date: isoDaysAgo(300), activity_type: 'commission_payment', amount: 1800 },
      { referral_id: brightpathReferral.id, message: 'Alex Morgan submitted a referral for Brightpath Credit Union (Marcus Bell).', activity_date: isoDaysAgo(145) },
      { referral_id: brightpathReferral.id, message: 'Brightpath Credit Union contacted and discovery call completed.', activity_date: isoDaysAgo(135) },
      { referral_id: brightpathReferral.id, message: 'Brightpath Credit Union purchased. First-year revenue: $6,500.', activity_date: isoDaysAgo(120) },
      { referral_id: brightpathReferral.id, message: 'Commission paid for Brightpath Credit Union ($650 at 10%).', activity_date: isoDaysAgo(115), activity_type: 'commission_payment', amount: 650 },
      { referral_id: meridianReferral.id, message: 'Alex Morgan submitted a referral for Meridian Health Group (Priya Nair).', activity_date: isoDaysAgo(48) },
      { referral_id: meridianReferral.id, message: 'Meridian Health Group converted to client. Proposal accepted ($24,000). Commission pending until purchase finalizes.', activity_date: isoDaysAgo(42) },
      { referral_id: harborReferral.id, message: 'Alex Morgan submitted a referral for Harbor Logistics (Tom Briggs). Awaiting review and outreach.', activity_date: isoDaysAgo(21) },
    ].map(a => Object.assign({ activity_type: 'note' }, a, { referral_partner_id: broker.id, is_demo: true }));
    await base44.asServiceRole.entities.ReferralActivity.bulkCreate(activities);

    // 10. Cohort assessments (WHO-5 pairs)
    const cohortRecords = [];

    // Lakeside cohort_start/cohort_end — 40 paired participants, +12-18% average improvement
    const lakesideCohort = participantPool('lakeside-demo.com', 40);
    for (const p of lakesideCohort) {
      const startCenter = 2.0 + Math.random() * 0.4;
      const endCenter = startCenter + 0.7 + Math.random() * 0.4;
      cohortRecords.push(buildCohort(lakeside.id, lakesideProposal.id, undefined, p, 'cohort_start', genWho5(startCenter), isoDaysAgo(335)));
      cohortRecords.push(buildCohort(lakeside.id, lakesideProposal.id, undefined, p, 'cohort_end', genWho5(endCenter), isoDaysAgo(20)));
    }

    // Lakeside challenge_day0/day14 pairs — 2 delivered challenges, ~30 pairs each (realistic variance, a few flat/negative)
    const lakesideChallenges = [[challengeSvc.id, 300, 286], [challengeSvc.id, 165, 151]];
    for (const [serviceId, d0, d14] of lakesideChallenges) {
      const pool = participantPool('lakeside-demo.com', 30);
      for (const p of pool) {
        const c0 = 2.1 + Math.random() * 0.4;
        const c14 = c0 + 0.6 + Math.random() * 0.5;
        cohortRecords.push(buildCohort(lakeside.id, lakesideProposal.id, serviceId, p, 'challenge_day0', genWho5(c0), isoDaysAgo(d0)));
        cohortRecords.push(buildCohort(lakeside.id, lakesideProposal.id, serviceId, p, 'challenge_day14', genWho5(c14), isoDaysAgo(d14)));
      }
    }

    // Brightpath — 1 delivered challenge, ~15 pairs
    {
      const pool = participantPool('brightpath-demo.com', 15);
      for (const p of pool) {
        const c0 = 2.1 + Math.random() * 0.4;
        const c14 = c0 + 0.6 + Math.random() * 0.5;
        cohortRecords.push(buildCohort(brightpath.id, brightpathProposal.id, challengeSvc.id, p, 'challenge_day0', genWho5(c0), isoDaysAgo(75)));
        cohortRecords.push(buildCohort(brightpath.id, brightpathProposal.id, challengeSvc.id, p, 'challenge_day14', genWho5(c14), isoDaysAgo(61)));
      }
    }

    // Meridian — cohort_start only (just started), 10 participants
    {
      const pool = participantPool('meridian-demo.com', 10);
      for (const p of pool) {
        cohortRecords.push(buildCohort(meridian.id, meridianProposal.id, undefined, p, 'cohort_start', genWho5(2.1 + Math.random() * 0.4), isoDaysAgo(8)));
      }
    }

    if (cohortRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(cohortRecords);

    // 11. Demo MFS companies — both credited to Alex Morgan via ref
    function noiseItem(center, min, max) {
      let v = Math.round(center + (Math.random() * 2 - 1));
      return Math.min(max, Math.max(min, v));
    }
    function generateMfsResponses(clientId, count, centers, daysBack) {
      const records = [];
      for (let i = 0; i < count; i++) {
        const sid = `mfs-demo-${crypto.randomUUID()}`;
        const submittedAt = isoDaysAgo(randInt(1, daysBack), randInt(8, 17));
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

    // ── Harborview Logistics — complete journey: 45 responses, composite ~61, Connection lowest ──
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
    // WHO-5 3.3→~66, PSS-4 1.5→~62, UWES-3 4.2→~70, UCLA-3 2.13→~43 (Connection notably lowest)
    const harborviewMfsRecords = generateMfsResponses(harborviewClient.id, 45, { who5: 3.3, pss4: 1.5, uwes3: 4.2, ucla3: 2.13 }, 14);
    if (harborviewMfsRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(harborviewMfsRecords);
    const harborviewMfsReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Jordan Reeves',
      contact_email: 'jordan.reeves@harborview-demo.com', company_name: 'Harborview Logistics',
      referred_lead_id: harborviewLead.id, referred_client_id: harborviewClient.id,
      referral_date: isoDaysAgo(15), status: 'pending_review', first_year_revenue: 0,
      commission_rate: 0.10, commission_amount: 0, notes: 'MFS assessment lead — 45 responses, dashboard ready.', is_demo: true,
    });

    // ── Brightwater Dental Group — early journey: 3 responses, privacy gate active ──
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
      referral_date: isoDaysAgo(5), status: 'pending_review', first_year_revenue: 0,
      commission_rate: 0.10, commission_amount: 0, notes: 'MFS assessment lead — 3 responses, privacy gate active.', is_demo: true,
    });

    // ── Cedar & Vine Hospitality — healthier team: 28 responses, composite ~68, Engagement strongest ──
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
    // WHO-5 3.3→~66 (mid-range), PSS-4 1.5→~62, UWES-3 4.5→~75 (strongest), UCLA-3 1.6→~70 — composite ~68
    const cedarMfsRecords = generateMfsResponses(cedarClient.id, 28, { who5: 3.3, pss4: 1.5, uwes3: 4.5, ucla3: 1.6 }, 10);
    if (cedarMfsRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(cedarMfsRecords);
    const cedarMfsReferral = await base44.asServiceRole.entities.Referral.create({
      referral_partner_id: broker.id, referral_partner_name: 'Alex Morgan', contact_name: 'Maria Santos',
      contact_email: 'maria.santos@cedarvine-demo.com', company_name: 'Cedar & Vine Hospitality',
      referred_lead_id: cedarLead.id, referred_client_id: cedarClient.id,
      referral_date: isoDaysAgo(10), status: 'pending_review', first_year_revenue: 0,
      commission_rate: 0.10, commission_amount: 0, notes: 'MFS assessment lead — 28 responses, dashboard ready.', is_demo: true,
    });

    // MFS referral activities
    const mfsActivities = [
      { referral_id: harborviewMfsReferral.id, message: 'Alex Morgan shared the Mental Fitness Score link. Harborview Logistics submitted an intake (140 employees, logistics).', activity_date: isoDaysAgo(15) },
      { referral_id: harborviewMfsReferral.id, message: 'Harborview Logistics MFS dashboard is ready — 45 employee responses collected. Composite score: ~61 (Connection notably lowest).', activity_date: isoDaysAgo(3) },
      { referral_id: brightwaterMfsReferral.id, message: 'Alex Morgan shared the Mental Fitness Score link. Brightwater Dental Group submitted an intake (35 employees, healthcare).', activity_date: isoDaysAgo(5) },
      { referral_id: brightwaterMfsReferral.id, message: 'Brightwater Dental Group is collecting responses — 3 of 5 so far (privacy gate active).', activity_date: isoDaysAgo(1) },
      { referral_id: cedarMfsReferral.id, message: 'Alex Morgan shared the Mental Fitness Score link. Cedar & Vine Hospitality submitted an intake (85 employees, hospitality).', activity_date: isoDaysAgo(10) },
      { referral_id: cedarMfsReferral.id, message: 'Cedar & Vine Hospitality MFS dashboard is ready — 28 employee responses collected. Composite score: ~68 (Engagement strongest, a healthier team).', activity_date: isoDaysAgo(2) },
    ].map(a => Object.assign({ activity_type: 'note' }, a, { referral_partner_id: broker.id, is_demo: true }));
    await base44.asServiceRole.entities.ReferralActivity.bulkCreate(mfsActivities);

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
        referral_partners: 1, clients: 6, leads: 4, proposals: 3, calendar_events: createdEvents.length,
        referrals: 7, referral_activities: activities.length + mfsActivities.length, feedback_responses: feedbackRecords.length,
        cohort_assessments: cohortRecords.length + harborviewMfsRecords.length + brightwaterMfsRecords.length + cedarMfsRecords.length,
        mfs_assessments: 3,
        mfs_responses: 76,
      },
    });
  } catch (error) {
    console.error('seedDemoData error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});