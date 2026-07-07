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