import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { advanceLeadsQuietly } from '../../shared/leadAutomationRunner.ts';
import { senderForOwner } from '../../shared/owners.ts';
import { finalFields, findSentCampaignEmail } from '../../shared/writingStyle.ts';

// ═══════════════════════════════════════════════════════════════════════════
// syncCampaignSendStatus — read-only Gmail check for campaign send/reply status.
//
// For each approved recipient: if the Gmail draft no longer exists in Drafts
// AND a sent message to that recipient newer than approved_at exists, mark "sent".
// For each sent recipient: if an inbound message from that recipient newer than
// sent_at exists, mark "replied".
//
// NEVER modifies anything in Gmail. Skips senders whose Gmail connector lacks
// readonly access (possible for Heather) and returns a note instead of erroring.
// ═══════════════════════════════════════════════════════════════════════════

async function checkDraftExists(accessToken, draftId) {
  if (!draftId) return false;
  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function searchMessages(accessToken, query) {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=1`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.messages?.[0] || null;
  } catch (e) {
    return null;
  }
}

// Earliest match for a query (Gmail lists newest first).
async function searchEarliestMessage(accessToken, query) {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list = data.messages || [];
    return list.length ? list[list.length - 1] : null;
  } catch (e) {
    return null;
  }
}

async function getMessageDate(accessToken, messageId) {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Date`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!res.ok) return new Date().toISOString();
    const data = await res.json();
    const dateHeader = data.payload?.headers?.find(h => h.name === 'Date');
    if (dateHeader) {
      const date = new Date(dateHeader.value);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    return new Date().toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

async function getMessageIdHeader(accessToken, messageId) {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Message-ID`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!res.ok) return '';
    const data = await res.json();
    const h = data.payload?.headers?.find(h => h.name === 'Message-ID')
      || data.payload?.headers?.find(h => h.name === 'Message-Id');
    return h?.value || '';
  } catch (e) {
    return '';
  }
}

async function fetchProfileEmail(accessToken) {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.emailAddress || null;
  } catch (e) {
    return null;
  }
}

async function getAccessToken(base44, sender) {
  if (sender === 'heather') {
    const clientId = Deno.env.get('HEATHER_GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('HEATHER_GMAIL_CLIENT_SECRET');
    const refreshToken = Deno.env.get('HEATHER_GMAIL_REFRESH_TOKEN');
    if (!clientId || !clientSecret || !refreshToken) return null;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    return tokenData.access_token || null;
  } else {
    const conn = await base44.asServiceRole.connectors.getConnection('gmail');
    return conn.accessToken || null;
  }
}

function resolveSender(campaign, recipient) {
  if (campaign.sender_mode === 'heather') return 'heather';
  if (campaign.sender_mode === 'william') return 'william';
  // Primary (first-listed) owner decides; a record can carry several owners.
  return senderForOwner(recipient.owner);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { campaign_id } = body;
    if (!campaign_id) {
      return Response.json({ error: 'Missing campaign_id' }, { status: 400 });
    }

    const campaign = await base44.entities.OutreachCampaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch all recipients, filter to approved + sent
    const allRecipients = await base44.entities.CampaignRecipient.filter(
      { campaign_id },
      '-created_date',
      500
    );
    const recipients = allRecipients.filter(r => r.status === 'approved' || r.status === 'sent');

    if (recipients.length === 0) {
      await base44.entities.OutreachCampaign.update(campaign_id, { last_status_sync_at: new Date().toISOString() });
      return Response.json({ success: true, checked: 0, sent: 0, replied: 0 });
    }

    // Group by sender
    const bySender = { william: [], heather: [] };
    for (const r of recipients) {
      const sender = resolveSender(campaign, r);
      bySender[sender].push(r);
    }

    let updatedSent = 0;
    let updatedReplied = 0;
    const notes = [];
    const profileCache = {};

    for (const sender of ['william', 'heather']) {
      const senderRecipients = bySender[sender];
      if (senderRecipients.length === 0) continue;

      // Get access token
      let accessToken;
      try {
        accessToken = await getAccessToken(base44, sender);
      } catch (e) {
        notes.push(`${sender === 'heather' ? 'Heather' : 'William'}'s recipients need manual status updates`);
        continue;
      }

      if (!accessToken) {
        notes.push(`${sender === 'heather' ? 'Heather' : 'William'}'s recipients need manual status updates`);
        continue;
      }

      for (const r of senderRecipients) {
        try {
          if (r.status === 'approved' && r.approved_at) {
            // Backfill draft_mailbox if missing (one profile fetch per sender, cached)
            if (!r.draft_mailbox) {
              if (!(sender in profileCache)) {
                profileCache[sender] = await fetchProfileEmail(accessToken);
              }
              const mb = profileCache[sender];
              if (mb) {
                try {
                  await base44.entities.CampaignRecipient.update(r.id, { draft_mailbox: mb });
                } catch (e) {
                  console.error(`[syncCampaignSendStatus] mailbox backfill error for ${r.id}:`, e.message);
                }
              }
            }

            // Check if a matching message was sent. We deliberately do NOT require
            // the draft to be gone first: Gmail keeps the draft resource retrievable
            // by its original id after Schedule Send delivers the message (verified
            // empirically 2026-08-05 — drafts.get returned 200 for four drafts whose
            // messages were already in Sent). A found sent-message always wins.
            //
            // 2026-10-15: this used to take the NEWEST sent message to the person after
            // approval, so a later unrelated email (a proposal reply, an invoice) could be
            // recorded as the campaign email — wrong sent_at, and a wrong thread_id that
            // would have put follow-up bumps in the wrong conversation. Now the earliest
            // sent message whose subject/text matches the draft wins (shared/writingStyle.ts).
            // Only if nothing matches AND the Gmail draft is gone (sent after a heavy
            // rewrite) do we fall back to the earliest message after approval.
            const approvedTs = Math.floor(new Date(r.approved_at).getTime() / 1000);
            let verified = null;
            try {
              verified = await findSentCampaignEmail(accessToken, r, { approvalWindowOnly: true });
            } catch (e) {
              console.warn(`[syncCampaignSendStatus] verified search failed for ${r.id}:`, e.message);
            }
            let sentMsg = verified ? { id: verified.messageId, threadId: verified.threadId } : null;
            if (!sentMsg && !(await checkDraftExists(accessToken, r.gmail_draft_id))) {
              const earliest = await searchEarliestMessage(accessToken, `to:${r.email} after:${approvedTs} before:${approvedTs + 30 * 86400} in:sent`);
              if (earliest) sentMsg = earliest;
            }

            if (sentMsg) {
              const msgDate = verified?.sentAt || await getMessageDate(accessToken, sentMsg.id);
              const updateFields = { status: 'sent', sent_at: msgDate };
              // thread_id + rfc_message_id of THIS message, so follow-up bumps reply in the
              // right conversation.
              if (sentMsg.threadId) updateFields.thread_id = sentMsg.threadId;
              const rfc = verified?.rfcMessageId || await getMessageIdHeader(accessToken, sentMsg.id);
              if (rfc) updateFields.rfc_message_id = rfc;
              // Writing-style learning: keep the text that actually went out (edits made in
              // Gmail included) next to Maya's version. Best-effort — never blocks the sync.
              if (verified?.body) {
                Object.assign(updateFields, finalFields(r, verified, 'gmail_sent'));
              }
              await base44.entities.CampaignRecipient.update(r.id, updateFields);

              // Flip the linked EmailLog from draft → sent so profile timelines
              // show the true state. Point gmail_message_id at the real sent
              // message (it previously held the draft id) so "Open in Gmail"
              // works and the historical-email scanner dedupes against this row.
              if (r.email_log_id) {
                try {
                  await base44.asServiceRole.entities.EmailLog.update(r.email_log_id, {
                    is_draft: false,
                    gmail_message_id: sentMsg.id,
                    date: msgDate,
                  });
                } catch (e) {
                  console.error(`[syncCampaignSendStatus] EmailLog update error for ${r.email_log_id}:`, e.message);
                }
              }

              updatedSent++;
            }
          } else if (r.status === 'sent' && r.sent_at) {
            const sentTs = Math.floor(new Date(r.sent_at).getTime() / 1000);

            // Backfill thread_id + rfc_message_id for already-sent recipients
            // (past campaigns) so they become follow-up-able. One-time per
            // recipient: once both are set, this block is skipped. Does NOT
            // change the existing reply detection below.
            if (!r.thread_id || !r.rfc_message_id) {
              // Earliest at/after sent_at (not the newest — a later email would be a different thread)
              const sentMsg2 = await searchEarliestMessage(accessToken, `to:${r.email} after:${sentTs - 60} before:${sentTs + 86400} in:sent`);
              if (sentMsg2) {
                const update2 = {};
                if (!r.thread_id && sentMsg2.threadId) update2.thread_id = sentMsg2.threadId;
                if (!r.rfc_message_id) {
                  const rfc2 = await getMessageIdHeader(accessToken, sentMsg2.id);
                  if (rfc2) update2.rfc_message_id = rfc2;
                }
                if (Object.keys(update2).length > 0) {
                  try {
                    await base44.entities.CampaignRecipient.update(r.id, update2);
                  } catch (e) {
                    console.error(`[syncCampaignSendStatus] thread backfill error for ${r.id}:`, e.message);
                  }
                }
              }
            }

            // Backfill: recipients marked sent before EmailLog syncing existed
            // may still have their EmailLog flagged is_draft. Fix idempotently.
            if (r.email_log_id) {
              try {
                const log = await base44.asServiceRole.entities.EmailLog.get(r.email_log_id);
                if (log && log.is_draft) {
                  await base44.asServiceRole.entities.EmailLog.update(r.email_log_id, {
                    is_draft: false,
                    date: r.sent_at,
                  });
                }
              } catch (e) {
                console.error(`[syncCampaignSendStatus] EmailLog backfill error for ${r.email_log_id}:`, e.message);
              }
            }

            // Check for inbound reply
            const replyMsg = await searchMessages(accessToken, `from:${r.email} after:${sentTs}`);

            if (replyMsg) {
              const msgDate = await getMessageDate(accessToken, replyMsg.id);
              await base44.entities.CampaignRecipient.update(r.id, {
                status: 'replied',
                replied_at: msgDate,
              });
              updatedReplied++;
            }
          }
        } catch (e) {
          // Skip individual errors gracefully
          console.error(`[syncCampaignSendStatus] Error for recipient ${r.id}:`, e.message);
        }
      }
    }

    await base44.entities.OutreachCampaign.update(campaign_id, { last_status_sync_at: new Date().toISOString() });

    // Move partner leads in this campaign on what was just sent / replied
    if (updatedSent + updatedReplied > 0) {
      const leadIds = [...new Set(recipients.filter(r => r.record_type === 'lead' && r.record_id).map(r => r.record_id))];
      await advanceLeadsQuietly(base44, { leadIds }, 'campaign');
    }

    return Response.json({
      success: true,
      checked: recipients.length,
      sent: updatedSent,
      replied: updatedReplied,
      notes: notes.length > 0 ? notes : undefined,
    });
  } catch (error) {
    console.error('[syncCampaignSendStatus] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});