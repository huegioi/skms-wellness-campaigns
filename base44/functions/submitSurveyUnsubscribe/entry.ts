import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, confirmed } = await req.json();
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    // Require an explicit confirmation flag, which the Unsubscribe page only
    // sends from its button's onClick handler.
    //
    // Corporate mail gateways (Microsoft Safe Links, Mimecast, Proofpoint)
    // pre-fetch every link in an inbound email to scan it. The old page ran the
    // unsubscribe on mount, so those scans silently opted people out: 15 of 19
    // recipients at one company were suppressed within minutes of delivery,
    // none of whom had clicked anything.
    //
    // This guard is deliberately server-side as well as client-side. A frontend
    // deploy can lag behind the repo, and until it lands the old auto-firing page
    // is still being served — refusing unconfirmed requests here stops the damage
    // immediately, whatever the browser is running.
    if (confirmed !== true) {
      return Response.json({
        error: 'Unsubscribe requires explicit confirmation.',
        reason: 'unconfirmed_request_rejected'
      }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();

    // Check if already suppressed
    const existing = await base44.asServiceRole.entities.EmailSuppression.filter({ email: normalized });
    if (existing.length > 0) {
      return Response.json({ success: true, already_suppressed: true });
    }

    await base44.asServiceRole.entities.EmailSuppression.create({
      email: normalized,
      suppressed_at: new Date().toISOString(),
      reason: 'unsubscribe'
    });

    return Response.json({ success: true, suppressed: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});