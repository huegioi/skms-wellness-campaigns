import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Team only' }, { status: 403 });

    // Fetch events sorted by start_date descending (future events first)
    const events = await base44.asServiceRole.entities.CalendarEvent.list('-start_date', 500);

    // Filter: upcoming, no token, not demo
    const now = new Date();
    const needsToken = events.filter(e =>
      !e.is_demo &&
      !e.checkin_token &&
      e.start_date &&
      new Date(e.start_date) >= now
    );

    let updated = 0;
    let tokensSkipped = 0;
    for (const event of needsToken) {
      // Every event gets a check-in token: the check-in page is the invite's landing page
      // regardless of whether a survey is attached.
      const token = crypto.randomUUID();
      await base44.asServiceRole.entities.CalendarEvent.update(event.id, { checkin_token: token });
      updated++;
    }

    return Response.json({
      success: true,
      updated,
      tokensSkipped,
      scanned: events.length,
      eligible: needsToken.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});