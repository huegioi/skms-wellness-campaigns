import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getOrgDomain } from '../../shared/emailDomain.ts';

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user: any) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Forbidden — team members only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true

    const allClients = await base44.asServiceRole.entities.Client.list('-created_date', 1000);

    const updates: any[] = [];
    const stats = { would_set_domain: 0, would_clear_to_null: 0, already_correct: 0, no_email: 0 };

    for (const client of allClients) {
      const computedDomain = getOrgDomain(client.email);

      if (!client.email) {
        stats.no_email++;
        continue;
      }

      if (computedDomain === null) {
        // Free-mail or excluded domain — domain should be null
        if (client.email_domain) {
          stats.would_clear_to_null++;
          updates.push({ id: client.id, name: client.name, email: client.email, old_domain: client.email_domain, new_domain: null });
          if (!dryRun) {
            await base44.asServiceRole.entities.Client.update(client.id, { email_domain: null });
          }
        } else {
          stats.already_correct++;
        }
      } else {
        // Organization domain — set it
        if (client.email_domain !== computedDomain) {
          stats.would_set_domain++;
          updates.push({ id: client.id, name: client.name, email: client.email, old_domain: client.email_domain || null, new_domain: computedDomain });
          if (!dryRun) {
            await base44.asServiceRole.entities.Client.update(client.id, { email_domain: computedDomain });
          }
        } else {
          stats.already_correct++;
        }
      }
    }

    return Response.json({
      dry_run: dryRun,
      total_clients: allClients.length,
      stats,
      updates: updates,
      summary: {
        domains_set: stats.would_set_domain,
        domains_cleared_to_null: stats.would_clear_to_null,
        already_correct: stats.already_correct,
        no_email: stats.no_email,
        total_changes: updates.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});