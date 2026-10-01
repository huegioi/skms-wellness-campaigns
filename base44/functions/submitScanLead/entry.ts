import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Public — called by the conference QR welcome screen (/Scan) when a visitor
 * leaves their name and email before being sent on to the tool.
 *
 * Writes ONE thing: a ScanLead held for review. It never files into Clients,
 * Partners or the legacy Lead table — that happens only when William or
 * Heather picks an action in the Dashboard Review Queue (reviewScanLead).
 * No email is sent to the visitor (see skms-no-auto-emails).
 *
 * Keep SOURCES in step with src/lib/qrLinks.js. An unknown key is stored as
 * 'unknown' rather than rejected so a scan is never lost.
 */
const SOURCES: Record<string, string> = {
  quickbuilder: 'Quick Builder',
  journey: 'Mental Fitness Journey',
  roi: 'ROI Calculator',
  demo: 'Client Demo',
  call: 'Book a Free Demo',
  william: "William's LinkedIn",
  heather: "Heather's LinkedIn",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEDUPE_MINUTES = 60;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
    const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const company = String(body.company || '').trim().replace(/\s+/g, ' ').slice(0, 160);
    const rawKey = String(body.source_key || '').toLowerCase().slice(0, 40);
    const source_key = SOURCES[rawKey] ? rawKey : 'unknown';
    const source_label = SOURCES[rawKey] || 'Unknown QR code';

    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // Same person rescanning the same code (or double-tapping Continue):
    // bump the count on the existing pending record instead of adding a row.
    const since = Date.now() - DEDUPE_MINUTES * 60 * 1000;
    const recent = await base44.asServiceRole.entities.ScanLead.filter(
      { email, source_key }, '-created_date', 1,
    );
    const dupe = recent?.[0];
    if (dupe && dupe.status === 'pending_review' && new Date(dupe.created_date).getTime() > since) {
      await base44.asServiceRole.entities.ScanLead.update(dupe.id, {
        scan_count: (dupe.scan_count || 1) + 1,
        ...(name && !dupe.name ? { name } : {}),
        ...(company && !dupe.company ? { company } : {}),
      });
      return Response.json({ ok: true, deduped: true });
    }

    const created = await base44.asServiceRole.entities.ScanLead.create({
      name: name || undefined,
      company: company || undefined,
      email,
      source_key,
      source_label,
      status: 'pending_review',
      scan_count: 1,
    });

    // Start the LinkedIn lookup (findScanLinkedIn, ~5–10s web search) without
    // making the visitor wait for it: give the request a moment to get going,
    // then send them on. If it doesn't run, the Review Queue starts it.
    if (name && created?.id) {
      const lookup = base44.functions.invoke('findScanLinkedIn', { scan_id: created.id })
        .catch((err: any) => console.error('[submitScanLead] LinkedIn lookup:', err?.message || err));
      await Promise.race([lookup, new Promise(r => setTimeout(r, 1500))]);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[submitScanLead]', (error as Error)?.message || error);
    return Response.json({ error: 'Could not save right now.' }, { status: 500 });
  }
});
