import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Public, read-only program list for the QuickBuilder gallery (step 3).
 *
 * The Service entity's RLS only lets signed-in users read it, so a prospect
 * opening /QuickBuilder saw an empty gallery — only people signed in to the
 * app (i.e. us) ever saw the programs. This returns just the display fields
 * for active, public programs. Prices, QuickBooks fields and internal flags
 * never leave the server.
 */
const PUBLIC_FIELDS = ['id', 'name', 'category', 'short_description', 'description', 'sort_order'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const all = await base44.asServiceRole.entities.Service.list('sort_order', 500);

    const services = (all || [])
      .filter(s => s.is_active !== false && s.public_visible !== false)
      .map(s => {
        const out: Record<string, unknown> = {};
        for (const k of PUBLIC_FIELDS) out[k] = s[k] ?? null;
        const first = Array.isArray(s.images) && s.images[0]?.url ? [{ url: s.images[0].url }] : [];
        out.images = first;
        return out;
      });

    return Response.json(
      { services },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message, services: [] }, { status: 500 });
  }
});
