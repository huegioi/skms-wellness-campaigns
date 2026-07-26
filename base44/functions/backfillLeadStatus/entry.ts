import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time backfill:
 * 1. Migrate Lead.status 'responded' → 'in_conversation'.
 * 2. Tag leads with their current follow_up_stage value where it carries
 *    meaning (non-sequence stages like "Event Follow-up", "Podcast", "NABIP Yes/No")
 *    using the existing Tag entity system.
 *
 * Does NOT delete follow_up_stage data — only adds tags alongside it.
 */

const TAG_COLORS = {
  'Event Follow-up': '#0ea5e9',
  'Podcast': '#8b5cf6',
  'Podcast Follow-up': '#a78bfa',
  'NABIP ?': '#f59e0b',
  'NABIP Yes': '#22c55e',
  'NABIP No': '#ef4444',
  'In-Person Meeting': '#013f7c',
  'In-Person Lunch': '#264d44',
  'New Referral Partner': '#22c55e',
  'Lunch & Learn': '#013f7c',
  'Active & Engaged': '#16a34a',
  'Quarterly Review': '#f59e0b',
  'Renewal Season Outreach': '#770142',
  'Re-engage Partner': '#f97316',
  'Inactive': '#94a3b8',
};

// Sequence stages (Day X) don't carry meaning as tags — skip them
const SEQUENCE_PREFIX = 'Day ';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Team only' }, { status: 403 });

    const leads = await base44.asServiceRole.entities.Lead.filter({ is_archived: { $ne: true } });

    // ── Part 1: Migrate responded → in_conversation ──────────────────────────
    let statusMigrated = 0;
    for (const lead of leads) {
      if (lead.status === 'responded') {
        await base44.asServiceRole.entities.Lead.update(lead.id, { status: 'in_conversation' });
        statusMigrated++;
      }
    }

    // ── Part 2: Tag leads with meaningful follow_up_stage values ──────────────
    const existingTags = await base44.asServiceRole.entities.Tag.list();
    const tagByName = {};
    for (const t of existingTags) tagByName[t.name.toLowerCase()] = t;

    // Determine which stages need tags
    const stagesToTag = new Set();
    for (const lead of leads) {
      const stage = lead.follow_up_stage;
      if (stage && !stage.startsWith(SEQUENCE_PREFIX)) {
        stagesToTag.add(stage);
      }
    }

    // Create missing tags
    let tagsCreated = 0;
    for (const stage of stagesToTag) {
      if (!tagByName[stage.toLowerCase()]) {
        const color = TAG_COLORS[stage] || '#6b7280';
        const newTag = await base44.asServiceRole.entities.Tag.create({
          name: stage,
          color,
          description: 'Migrated from follow_up_stage',
        });
        tagByName[stage.toLowerCase()] = newTag;
        tagsCreated++;
      }
    }

    // Apply tags to leads
    let leadsTagged = 0;
    for (const lead of leads) {
      const stage = lead.follow_up_stage;
      if (!stage || stage.startsWith(SEQUENCE_PREFIX)) continue;
      const currentTags = lead.tags || [];
      if (currentTags.includes(stage)) continue;
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        tags: [...currentTags, stage],
      });
      leadsTagged++;
    }

    console.log(`[backfillLeadStatus] Migrated ${statusMigrated} statuses, created ${tagsCreated} tags, tagged ${leadsTagged} leads.`);

    return Response.json({
      success: true,
      statusMigrated,
      tagsCreated,
      leadsTagged,
      totalLeads: leads.length,
    });
  } catch (error) {
    console.error('backfillLeadStatus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});