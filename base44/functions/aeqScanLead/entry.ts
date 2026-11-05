import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Public. Called by the Athletic EQ QR page (/AthleticEQ) when a visitor leaves
 * their details. Saves a backup copy in AeqScanLead, then adds a row to the
 * Notion database "Athletic EQ Form". An email already in Notion is not added
 * again. No email is sent to the visitor.
 *
 * A Notion failure never blocks the visitor: the backup stays marked "failed"
 * and the next submission retries it.
 *
 * Keep MET_BY in step with src/lib/athleticEqQr.js.
 */
const NOTION_DATABASE_ID = '18903d586bc780bd9ff3c48fef4f5107';
const OWNER_WILLIAM = 'b8b5dc35-3fb5-481d-9646-23156c0f5188';
const MET_BY: Record<string, string> = { william: 'William', trevon: 'Trevon', website: 'Not specified', talk: 'Not specified' };
const ROLES = [
  'Athletic Director or Assistant AD',
  'Head of School or Administrator',
  'Coach',
  'Counselor or Health Staff',
  'Other',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEDUPE_MINUTES = 60;

const clean = (v: unknown, max: number) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, max);

async function notion(path: string, body: unknown) {
  const key = Deno.env.get('Notion_Internal_Integration_Secret');
  if (!key) throw new Error('Notion secret is not configured');
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Returns the update to store on the backup record. */
async function sendToNotion(lead: Record<string, string>) {
  try {
    const found = await notion(`databases/${NOTION_DATABASE_ID}/query`, {
      filter: { property: 'Email', email: { equals: lead.email } },
      page_size: 1,
    });
    if (found.results?.length) {
      return { notion_status: 'already_in_notion', notion_page_id: found.results[0].id, notion_error: '' };
    }
    const school = lead.school || lead.email.split('@')[1];
    const properties: Record<string, unknown> = {
      'Which school are you affiliated with': { title: [{ text: { content: school } }] },
      Email: { email: lead.email },
      'Follow Up': { select: { name: 'Needs Follow Up' } },
      Status: { status: { name: 'Not started' } },
      Source: { select: { name: lead.source_key === 'talk' ? 'Presentation' : 'QR code' } },
      'Met by': { select: { name: lead.met_by } },
      Owner: { people: [{ object: 'user', id: OWNER_WILLIAM }] },
    };
    if (lead.name) properties.Name = { rich_text: [{ text: { content: lead.name } }] };
    if (ROLES.includes(lead.role)) properties.Role = { select: { name: lead.role } };
    const page = await notion('pages', { parent: { database_id: NOTION_DATABASE_ID }, properties });
    return { notion_status: 'sent', notion_page_id: page.id, notion_error: '' };
  } catch (err) {
    const message = (err as Error)?.message || String(err);
    console.error('[aeqScanLead] Notion:', message);
    return { notion_status: 'failed', notion_error: message.slice(0, 500) };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Hidden field only a bot fills in: answer as if it worked, store nothing.
    if (body.company_url) return Response.json({ ok: true });

    const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    const rawKey = String(body.source_key || '').toLowerCase().slice(0, 40);
    const source_key = MET_BY[rawKey] ? rawKey : 'website';
    const entity = base44.asServiceRole.entities.AeqScanLead;

    // Same person rescanning or double-tapping: count it, don't add a row.
    const recent = (await entity.filter({ email }, '-created_date', 1))?.[0];
    if (recent && new Date(recent.created_date).getTime() > Date.now() - DEDUPE_MINUTES * 60000) {
      await entity.update(recent.id, { scan_count: (recent.scan_count || 1) + 1 });
      return Response.json({ ok: true, deduped: true });
    }

    const lead = {
      name: clean(body.name, 120),
      email,
      school: clean(body.school, 160),
      role: ROLES.includes(body.role) ? body.role : '',
      source_key,
      met_by: MET_BY[source_key],
    };
    const created = await entity.create({ ...lead, notion_status: 'pending', scan_count: 1 });
    const result = await sendToNotion(lead);
    await entity.update(created.id, result);

    // Notion is reachable again: send anything an earlier failure left behind.
    if (result.notion_status !== 'failed') {
      const stuck = await entity.filter({ notion_status: 'failed' }, 'created_date', 5);
      for (const old of stuck || []) await entity.update(old.id, await sendToNotion(old));
    }

    return Response.json({ ok: true, notion_status: result.notion_status });
  } catch (error) {
    console.error('[aeqScanLead]', (error as Error)?.message || error);
    return Response.json({ error: 'Could not save right now.' }, { status: 500 });
  }
});
