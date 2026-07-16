// Shared last-touch resolver: merges ClientInteraction records and EmailLog rows
// to find the most recent touch per contact. Emails count as channel 'email'.
// Only considers emails from the last 90 days with a matched contact id.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Build a map of contactId -> { date, channel } representing the latest touch.
 *
 * @param {Array} interactions - ClientInteraction records
 * @param {Array} emailLogs - EmailLog records
 * @param {string} interactionIdField - field on interactions to group by
 *   (e.g. 'lead_id', 'client_id', 'referral_partner_id')
 * @param {string[]} emailIdFields - fields on EmailLog to group by
 *   (e.g. ['matched_lead_id'], ['matched_client_id'])
 * @returns {Object} map of contactId -> { date, channel }
 */
export function buildLatestTouchMap(interactions, emailLogs, interactionIdField, emailIdFields = []) {
  const map = {};
  const now = Date.now();

  const consider = (id, date, channel) => {
    if (!id || !date) return;
    const existing = map[id];
    if (!existing || new Date(date) > new Date(existing.date)) {
      map[id] = { date, channel };
    }
  };

  for (const i of interactions || []) {
    consider(i[interactionIdField], i.date, i.channel || i.interaction_type || 'other');
  }

  for (const e of emailLogs || []) {
    const emailTime = new Date(e.date).getTime();
    if (isNaN(emailTime) || (now - emailTime) > NINETY_DAYS_MS) continue;
    for (const field of emailIdFields) {
      if (e[field]) consider(e[field], e.date, 'email');
    }
  }

  return map;
}

/**
 * Build a map of contactId -> { [channel]: { date } } for channel indicators.
 * Channels: linkedin, email, phone, text, meeting.
 * Interactions contribute via `channel`/`interaction_type`; matched EmailLogs
 * contribute 'email'; calendar events (optional) contribute 'meeting'.
 */
export function buildChannelSummaryMap(interactions, emailLogs, interactionIdField, emailIdFields = [], calendarEvents = null, calendarIdField = null) {
  const map = {};
  const now = Date.now();

  const record = (id, channel, date) => {
    if (!id || !date || !channel) return;
    if (!map[id]) map[id] = {};
    const existing = map[id][channel];
    if (!existing || new Date(date) > new Date(existing.date)) {
      map[id][channel] = { date };
    }
  };

  const channelAlias = (raw) => {
    if (!raw) return null;
    const c = raw.toLowerCase();
    if (c === 'linkedin') return 'linkedin';
    if (c === 'email') return 'email';
    if (c === 'call' || c === 'phone') return 'phone';
    if (c === 'text') return 'text';
    if (c === 'meeting') return 'meeting';
    return null;
  };

  for (const i of interactions || []) {
    const channel = channelAlias(i.channel || i.interaction_type);
    if (!channel) continue;
    record(i[interactionIdField], channel, i.date);
  }

  for (const e of emailLogs || []) {
    const emailTime = new Date(e.date).getTime();
    if (isNaN(emailTime) || (now - emailTime) > NINETY_DAYS_MS) continue;
    for (const field of emailIdFields) {
      if (e[field]) record(e[field], 'email', e.date);
    }
  }

  if (calendarEvents && calendarIdField) {
    for (const ev of calendarEvents) {
      if (!ev[calendarIdField] || !ev.start_date) continue;
      record(ev[calendarIdField], 'meeting', ev.start_date);
    }
  }

  return map;
}