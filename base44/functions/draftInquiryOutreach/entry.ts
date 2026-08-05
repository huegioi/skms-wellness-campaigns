import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// draftInquiryOutreach — frontend-callable wrapper that creates a Gmail DRAFT
// (never sends) for a New Inquiries lead. Auths via base44.auth.me() (admin),
// reads MAYA_INTERNAL_KEY from env, and delegates to the EXISTING
// gmailCreateDraft backend function for the actual Gmail API call.
//
// Drafts ONLY. This app never auto-sends outreach email — the admin reviews
// the draft in Gmail's Drafts folder and sends it manually.
// ═══════════════════════════════════════════════════════════════════════════

// Parse "Composite: NN/100 · Projected annual savings: $X" from lead notes.
// Returns { score, savings } or null when absent / unparseable.
function parseCompositeAndSavings(notes) {
  if (!notes) return null;
  const m = String(notes).match(/Composite:\s*(\d+)\s*\/\s*100\s*·\s*Projected annual savings:\s*\$?([\d,]+)/i);
  if (!m) return null;
  const score = parseInt(m[1], 10);
  const savings = parseInt(m[2].replace(/,/g, ''), 10);
  if (isNaN(score) || isNaN(savings)) return null;
  return { score, savings };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    let body;
    try { body = await req.json(); } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { lead_id, response_count } = body;
    if (!lead_id) {
      return Response.json({ error: 'lead_id is required' }, { status: 400 });
    }

    let lead;
    try {
      lead = await base44.asServiceRole.entities.Lead.get(lead_id);
    } catch {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }
    if (!lead.email) {
      return Response.json({ error: 'Lead has no email address' }, { status: 400 });
    }

    const parsed = parseCompositeAndSavings(lead.notes);
    const score = parsed?.score;
    const savings = parsed?.savings;
    const firstName = (lead.name || '').split(' ')[0] || 'there';

    const lines = [
      `Hi ${firstName},`,
      ``,
      `Thanks for running the Mental Fitness Score exercise with your team — it's a genuinely useful snapshot of where your people are right now.`,
    ];
    if (score != null) {
      lines.push(`Your team's composite Mental Fitness Score came in at ${score}/100.`);
    }
    if (savings != null) {
      lines.push(`Based on your headcount, that projects to roughly $${savings.toLocaleString()} in potential annual savings — real money sitting on the table.`);
    }
    lines.push(``);
    if (Number(response_count) === 0) {
      lines.push(`It looks like only a handful of your folks have taken the short team survey so far. Happy to send a quick, easy-to-forward nudge to help get it in front of more of your people, if that'd be useful.`);
      lines.push(``);
    }
    lines.push(`Either way, I can share a short breakdown of what's driving the score and a couple of low-lift ways to move the needle. Want me to send over a one-pager, or grab 15 minutes to walk through it?`);
    lines.push(``);
    lines.push(`Warmly,`);
    lines.push(`William`);

    const emailBody = lines.join('\n');
    const subject = `Your team's Mental Fitness results — quick thought`;

    const internalKey = Deno.env.get('MAYA_INTERNAL_KEY');
    if (!internalKey) {
      return Response.json({ error: 'MAYA_INTERNAL_KEY is not configured' }, { status: 500 });
    }

    // Delegate to the existing internal-only gmailCreateDraft function.
    // It creates a Gmail DRAFT only — never sends.
    const draftRes = await base44.functions.invoke('gmailCreateDraft', {
      sender: 'william',
      to: lead.email,
      subject,
      body: emailBody,
      lead_id: lead.id,
      internal_key: internalKey,
    });

    if (draftRes.status !== 200) {
      return Response.json(
        { error: draftRes.data?.error || 'Failed to create draft' },
        { status: draftRes.status || 500 }
      );
    }

    return Response.json({
      draft_created: true,
      gmail_draft_id: draftRes.data?.gmail_draft_id,
      email_log_id: draftRes.data?.email_log_id,
    });
  } catch (error) {
    console.error('[draftInquiryOutreach] Unhandled error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});