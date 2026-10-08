import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildRecipientBrief } from '../../shared/draftContext.ts';

/**
 * One-page prep for an upcoming meeting with a partner lead (Maya's "Prep" item).
 * Input: { lead_id, event_id? }. Uses the same per-person brief as campaign drafts
 * (notes, meeting notes, emails both ways, stage, next step, event, brokerage).
 * Returns { prep } as short plain text sections. Read-only — writes nothing.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { lead_id, event_id } = await req.json().catch(() => ({}));
    if (!lead_id) return Response.json({ error: 'lead_id is required' }, { status: 400 });

    const [lead] = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    const [event] = event_id ? await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id }) : [];

    const brief = await buildRecipientBrief(base44, {
      record_type: 'lead', record_id: lead.id, email: lead.email, company: lead.company,
    });

    const when = event?.start_date
      ? new Date(event.start_date).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'soon';

    const prompt = `You prepare William or Heather of SkillfulMeans (preventative mental fitness programs sold to employers through insurance brokers) for a meeting with a broker partner.
Meeting: "${event?.title || 'Meeting'}" — ${when}.

Write a prep sheet they can read in 60 seconds, using ONLY the facts below. Plain text, these headings, 1–3 short lines each:
WHO: who they are and how we know them.
WHERE WE LEFT OFF: the last real exchange or meeting, and any agreed next step.
WHAT THEY CARE ABOUT: from their own words, notes and meeting notes.
THE ASK: the one concrete thing to leave this meeting with (for a broker: an intro to a specific employer group, a co-hosted lunch & learn, a signed partner agreement — whichever fits the facts).
GOOD QUESTIONS: 2–3 questions worth asking.
WATCH FOR: anything awkward or unresolved (only if the facts show it).
If something is unknown, say "not on file" — never invent.

FACTS:
${brief.text}`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: 'claude_sonnet_4_6' });
    const prep = typeof res === 'string' ? res : (res?.text || JSON.stringify(res));
    return Response.json({ prep, thin: !brief.rich });
  } catch (error) {
    console.error('[mayaMeetingPrep]', (error as any)?.message);
    return Response.json({ error: (error as any)?.message }, { status: 500 });
  }
});
