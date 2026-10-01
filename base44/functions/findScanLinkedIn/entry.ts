import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Looks up a conference scan's LinkedIn profile with a web search and saves
 * the link on the ScanLead, so the Review Queue card can show
 * "Connect on LinkedIn".
 *
 * Who can call it:
 *  - submitScanLead, right after a scan is saved (no signed-in user). A
 *    caller without a user may only run the FIRST lookup for a scan
 *    (linkedin_status empty), so this can't be used to burn searches.
 *  - The Review Queue (signed in): runs for scans that were never looked up
 *    and for "Search again".
 *
 * Only a linkedin.com/in/ link the search actually returned is kept, and
 * only when the model is at least fairly sure it's the same person (name +
 * company/domain). Otherwise the card falls back to "Find on LinkedIn",
 * which opens LinkedIn's own people search for that name and company.
 * Reads the public web only. Never contacts the person.
 */

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'comcast.net',
]);
const PROFILE_RE = /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%.]+)\/?/i;

function normalizeProfile(url: unknown): string | null {
  const m = String(url || '').trim().match(PROFILE_RE);
  if (!m) return null;
  return `https://www.linkedin.com/in/${m[1].replace(/\/+$/, '')}/`;
}

const SCHEMA = {
  type: 'object',
  properties: {
    linkedin_url: { type: 'string', description: 'linkedin.com/in/ profile URL exactly as found in search results, or empty string' },
    profile_name: { type: 'string' },
    headline: { type: 'string', description: "The profile's headline / current role and company" },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
    reason: { type: 'string' },
  },
  required: ['linkedin_url', 'confidence'],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const scanId = String(body.scan_id || '');
    if (!scanId) return Response.json({ error: 'scan_id is required' }, { status: 400 });

    const scan = (await base44.asServiceRole.entities.ScanLead.filter({ id: scanId }))?.[0];
    if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });

    if (!user && scan.linkedin_status) {
      return Response.json({ ok: true, skipped: 'already looked up' });
    }
    // A link pasted by hand is never overwritten by the search.
    if (scan.linkedin_status === 'manual' && scan.linkedin_url) {
      return Response.json({ ok: true, skipped: 'manual link', linkedin_url: scan.linkedin_url });
    }

    const name = String(scan.name || '').trim();
    if (!name) {
      await base44.asServiceRole.entities.ScanLead.update(scan.id, {
        linkedin_status: 'not_found', linkedin_checked_at: new Date().toISOString(),
        linkedin_headline: 'No name given, so no search was run',
      });
      return Response.json({ ok: true, status: 'not_found' });
    }

    await base44.asServiceRole.entities.ScanLead.update(scan.id, {
      linkedin_status: 'searching', linkedin_checked_at: new Date().toISOString(),
    });

    const domain = String(scan.email || '').split('@')[1]?.toLowerCase() || '';
    const workDomain = domain && !FREE_MAIL.has(domain) ? domain : '';
    const prompt = [
      'Find the LinkedIn profile of a person we met at an insurance / employee-benefits industry conference (ITC Vegas and similar).',
      `Name: ${name}`,
      scan.company ? `Company they gave: ${scan.company}` : 'Company: not given',
      workDomain ? `Work email domain: ${workDomain} (use it to confirm the employer)` : '',
      '',
      'Search the web (for example: "' + name + (scan.company ? ' ' + scan.company : '') + ' LinkedIn").',
      'Rules:',
      '- Return a linkedin.com/in/ profile URL ONLY if it appeared in the search results. Never build or guess a URL from the name.',
      '- The name must match, and the employer (current or recent) should match the company or email domain.',
      '- If several people share the name and you cannot tell which one, return an empty linkedin_url with confidence "none".',
      '- confidence: "high" = name and company both match; "medium" = name matches and the company/industry is consistent; "low" = unsure; "none" = nothing found.',
      '- headline: the profile headline or current title and company, as shown in the result.',
    ].filter(Boolean).join('\n');

    let res: any = null;
    try {
      res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt, add_context_from_internet: true, response_json_schema: SCHEMA,
      });
    } catch (err) {
      console.error('[findScanLinkedIn] search failed:', (err as any)?.message || err);
      await base44.asServiceRole.entities.ScanLead.update(scan.id, {
        linkedin_status: 'error', linkedin_checked_at: new Date().toISOString(),
      });
      return Response.json({ ok: false, status: 'error' });
    }

    const url = normalizeProfile(res?.linkedin_url);
    const confidence = String(res?.confidence || 'none').toLowerCase();
    const accepted = !!url && (confidence === 'high' || confidence === 'medium');
    const headline = [res?.profile_name, res?.headline].map(s => String(s || '').trim()).filter(Boolean).join(' — ').slice(0, 240);

    // Re-read so a link pasted by hand while we searched isn't overwritten.
    const latest = (await base44.asServiceRole.entities.ScanLead.filter({ id: scan.id }))?.[0];
    if (latest?.linkedin_status === 'manual') {
      return Response.json({ ok: true, skipped: 'manual link' });
    }

    await base44.asServiceRole.entities.ScanLead.update(scan.id, accepted ? {
      linkedin_status: 'found',
      linkedin_url: url,
      linkedin_headline: headline || undefined,
      linkedin_confidence: confidence,
      linkedin_checked_at: new Date().toISOString(),
    } : {
      linkedin_status: 'not_found',
      linkedin_url: '',
      linkedin_headline: '',
      linkedin_confidence: confidence,
      linkedin_checked_at: new Date().toISOString(),
    });
    return Response.json({
      ok: true, status: accepted ? 'found' : 'not_found',
      linkedin_url: accepted ? url : null, headline, confidence, reason: res?.reason || '',
    });
  } catch (error) {
    console.error('[findScanLinkedIn]', (error as Error)?.message || error);
    return Response.json({ error: 'Lookup failed' }, { status: 500 });
  }
});
