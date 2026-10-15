// @ts-nocheck
/**
 * Writing-style learning — shared helpers (2026-10-15).
 *
 * The loop:
 *   1. generateCampaignDraft keeps Maya's own version on the row (maya_subject / maya_body),
 *      even if the draft is later edited in the app.
 *   2. approveCampaignDraft snapshots the approved text (final_*, source "approved");
 *      syncCampaignSendStatus / learnWritingStyle replace it with what Gmail actually sent
 *      (source "gmail_sent"), so edits made in Gmail count too.
 *   3. learnWritingStyle compares the two, and distils the differences into a short rule list
 *      per sender (WritingStyleProfile).
 *   4. generateCampaignDraft adds that profile to the voice rules for every new draft.
 *
 * Read-only against Gmail. Nothing here sends or modifies mail.
 */

export const SENDER_NAME = { william: 'William', heather: 'Heather' };

/** Whose voice an email was written in: the mailbox it went out from wins. */
export function senderForRecipient(recipient, campaign) {
  const mb = String(recipient?.draft_mailbox || '').toLowerCase();
  if (mb.startsWith('heather@')) return 'heather';
  if (mb.startsWith('william@')) return 'william';
  if (campaign?.sender_mode === 'heather') return 'heather';
  if (campaign?.sender_mode === 'william') return 'william';
  const owner = String(recipient?.owner || '').split(',')[0].trim().toLowerCase();
  return owner === 'heather' ? 'heather' : 'william';
}

// ── Gmail access (same credentials syncCampaignSendStatus uses) ──────────────
export async function gmailAccessToken(base44, sender) {
  try {
    if (sender === 'heather') {
      const clientId = Deno.env.get('HEATHER_GMAIL_CLIENT_ID');
      const clientSecret = Deno.env.get('HEATHER_GMAIL_CLIENT_SECRET');
      const refreshToken = Deno.env.get('HEATHER_GMAIL_REFRESH_TOKEN');
      if (!clientId || !clientSecret || !refreshToken) return null;
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      return (await res.json()).access_token || null;
    }
    const conn = await base44.asServiceRole.connectors.getConnection('gmail');
    return conn?.accessToken || null;
  } catch {
    return null;
  }
}

function decodeBase64Url(data) {
  const b64 = String(data).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function findPart(payload, mime) {
  if (!payload) return null;
  if (payload.mimeType === mime && payload.body?.data) return payload.body.data;
  for (const p of payload.parts || []) {
    const hit = findPart(p, mime);
    if (hit) return hit;
  }
  return null;
}

export function htmlToText(html) {
  return String(html || '')
    // Gmail wraps the quoted thread and (sometimes) the signature — drop them before flattening
    .replace(/<div class="gmail_quote[\s\S]*$/i, '')
    .replace(/<blockquote[\s\S]*$/i, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SIGNOFF = /^(best|best regards|warm regards|warmly|warmest|kind regards|regards|thanks|thank you|many thanks|thanks so much|cheers|talk soon|all the best|sincerely|with gratitude|gratefully)[,!.]?\s*$/i;

/** The email as the person wrote it: no quoted thread, nothing below the sign-off name. */
export function cleanEmailText(text) {
  let t = String(text || '').replace(/\r\n/g, '\n');
  // Quoted thread: "On Mon, Oct 5, 2026 at 11:45 AM Heather Wise <…> wrote:" (may wrap onto 2 lines)
  const quote = t.search(/\n\s*On [^\n]{0,200}(\n[^\n]{0,200})?wrote:\s*(\n|$)/);
  if (quote > 0) t = t.slice(0, quote);
  const fwd = t.search(/\n-{5,}\s*Forwarded message/i);
  if (fwd > 0) t = t.slice(0, fwd);
  const sigDash = t.search(/\n-- ?\n/);
  if (sigDash > 0) t = t.slice(0, sigDash);
  const lines = t.split('\n').filter(l => !/^\s*>/.test(l));
  // Keep through the LAST sign-off + the name line under it; the rest is the Gmail signature.
  let cut = -1;
  for (let i = lines.length - 1; i >= 1; i--) {
    if (SIGNOFF.test(lines[i].trim())) { cut = i; break; }
  }
  let out = lines;
  if (cut >= 0) {
    let end = cut;
    for (let j = cut + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (lines[j].trim().length <= 40) end = j;
      break;
    }
    out = lines.slice(0, end + 1);
  }
  return out.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function words(s) {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}'@./:-]+/gu, ' ').split(' ').filter(Boolean);
}

/** Share of words changed between two versions (word-level LCS). 0 = same, 1 = nothing kept. */
export function editRatio(before, after) {
  const a = words(before).slice(0, 500);
  const b = words(after).slice(0, 500);
  if (!a.length && !b.length) return 0;
  if (!a.length || !b.length) return 1;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  const lcs = prev[b.length];
  return Math.round((1 - (2 * lcs) / (a.length + b.length)) * 1000) / 1000;
}

async function gmailGet(accessToken, path) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

/** Subject + cleaned body of one Gmail message. */
export async function readGmailMessage(accessToken, messageId) {
  const msg = await gmailGet(accessToken, `messages/${messageId}?format=full`);
  if (!msg?.payload) return null;
  const subject = msg.payload.headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
  const plain = findPart(msg.payload, 'text/plain');
  const html = findPart(msg.payload, 'text/html');
  const raw = plain ? decodeBase64Url(plain) : html ? htmlToText(decodeBase64Url(html)) : '';
  return { subject, body: cleanEmailText(raw), messageId };
}

/**
 * Find the campaign email as it was actually sent. Tight time window around sent_at first
 * (sent_at is the sent message's own Date header), then the thread, then "after approval".
 */
export async function findSentCampaignEmail(accessToken, recipient) {
  const email = String(recipient?.email || '').trim();
  if (!email) return null;
  const list = async (q) => {
    const data = await gmailGet(accessToken, `messages?q=${encodeURIComponent(q)}&maxResults=5`);
    return data?.messages || [];
  };
  let hits = [];
  if (recipient.sent_at) {
    const s = Math.floor(new Date(recipient.sent_at).getTime() / 1000);
    hits = await list(`to:${email} in:sent after:${s - 900} before:${s + 900}`);
  }
  if (!hits.length && recipient.thread_id) {
    const thread = await gmailGet(accessToken, `threads/${recipient.thread_id}?format=minimal`);
    const sent = (thread?.messages || []).find(m => (m.labelIds || []).includes('SENT'));
    if (sent) hits = [sent];
  }
  if (!hits.length && recipient.approved_at) {
    const a = Math.floor(new Date(recipient.approved_at).getTime() / 1000);
    const all = await list(`to:${email} in:sent after:${a}`);
    if (all.length) hits = [all[all.length - 1]]; // list is newest first → take the earliest after approval
  }
  if (!hits.length) return null;
  return readGmailMessage(accessToken, hits[0].id);
}

/** Maya's side of the comparison (rows from before 2026-10-15 only have the approved draft). */
export function mayaVersion(recipient) {
  return {
    subject: recipient?.maya_subject || recipient?.draft_subject || '',
    body: cleanEmailText(recipient?.maya_body || recipient?.draft_body || ''),
  };
}

/** Under this share of changed words an email counts as "sent as drafted". */
export const UNCHANGED_THRESHOLD = 0.03;

/** Fields to write once the sent version is known. */
export function finalFields(recipient, sent, source) {
  const before = mayaVersion(recipient);
  const ratio = editRatio(before.body, sent.body);
  return {
    final_subject: sent.subject || recipient.draft_subject || '',
    final_body: sent.body,
    final_source: source,
    final_captured_at: new Date().toISOString(),
    edit_ratio: ratio,
    ...(source === 'gmail_sent' && !['learned', 'unchanged'].includes(recipient.style_status)
      ? { style_status: ratio < UNCHANGED_THRESHOLD ? 'unchanged' : 'pending' }
      : {}),
  };
}

/**
 * Prompt block for generateCampaignDraft. Empty string when there is no active profile.
 * Order matters: learned rules refine the base voice; the sender's own rules win over both.
 */
export async function styleBlockFor(base44, sender) {
  try {
    const rows = await base44.asServiceRole.entities.WritingStyleProfile.filter({ sender }, '-updated_date', 1);
    const p = rows?.[0];
    if (!p || p.is_active === false) return '';
    const name = SENDER_NAME[sender] || 'the sender';
    const learned = (p.learned_rules || []).map(r => String(r).trim()).filter(Boolean);
    const own = String(p.own_rules || '').split('\n').map(r => r.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
    const examples = (p.examples || []).filter(e => e?.before && e?.after).slice(0, 3);
    if (!learned.length && !own.length && !examples.length) return '';
    const parts = [];
    if (learned.length) {
      parts.push(`LEARNED FROM ${name.toUpperCase()}'S OWN EDITS TO EARLIER DRAFTS (follow these; where they conflict with the general voice rules above, these win):\n${learned.map(r => `- ${r}`).join('\n')}`);
    }
    if (examples.length) {
      parts.push(`HOW ${name.toUpperCase()} REWROTE EARLIER DRAFTS (tone and wording only — never reuse their facts, names, events or details):\n${examples.map(e => `Maya wrote: "${e.before}"\n${name} sent: "${e.after}"${e.why ? `\n(${e.why})` : ''}`).join('\n\n')}`);
    }
    if (own.length) {
      parts.push(`${name.toUpperCase()}'S OWN RULES (always follow — these override everything above):\n${own.map(r => `- ${r}`).join('\n')}`);
    }
    return parts.join('\n\n');
  } catch (e) {
    console.warn('[writingStyle] profile lookup failed:', e?.message);
    return '';
  }
}
