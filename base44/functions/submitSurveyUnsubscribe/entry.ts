import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

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