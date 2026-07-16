import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Regenerates a ReferralPartner's unique_portal_id using crypto.randomUUID().
 * Admin-only. The old portal link is immediately invalidated.
 */

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { partner_id } = await req.json();
    if (!partner_id) {
      return Response.json({ error: 'partner_id is required' }, { status: 400 });
    }

    const newPortalId = crypto.randomUUID();

    await base44.asServiceRole.entities.ReferralPartner.update(partner_id, {
      unique_portal_id: newPortalId,
    });

    return Response.json({
      success: true,
      partner_id,
      portal_id: newPortalId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});