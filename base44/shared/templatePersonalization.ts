// ── Portal email-template matching + personalization (shared) ──────────────
//
// Used by getClientPortalData and getPublicProposal. Replaces the old model
// where the portal received EVERY EmailTemplate and filtered in the browser.
//
// A template appears in a client's portal when ONE of these holds:
//   1. AUTO  — its service is purchased by the client (purchased_services or
//      any accepted proposal's selections) AND that service is BOOKED: the
//      client has a calendar event for it. No booking → template stays hidden.
//   2. MANUAL — its id is in client.portal_template_ids (admin assigned it).
//      Shows even without a booked event; event fields fall back to
//      "[to be scheduled]" text.
//   3. CLIENT-SPECIFIC — template.client_id === client.id. Same fallback
//      behavior as manual.
// A template whose client_id points at a DIFFERENT client is always excluded.
//
// Placeholders substituted server-side: {{client_name}}, {{company}},
// {{service_name}}, {{event_date}}, {{event_time}}, {{event_location}},
// {{event_link}}. Invoice placeholders are replaced with neutral bracket
// text (portals have no invoice context).

type AnyRecord = Record<string, any>;

const SERVICE_ARRAY_KEYS = ['workshops', 'challengePrograms', 'leadership', 'movementClasses'];

const TBD = {
  event_date: '[Event date — to be scheduled]',
  event_time: '[Event time — to be scheduled]',
  event_location: '[Location — to be confirmed]',
  event_link: '[Meeting link — to be confirmed]',
};

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/** Service IDs the client has purchased (manual field + accepted proposal selections). */
export function purchasedServiceIds(client: AnyRecord, proposals: AnyRecord[]): Set<string> {
  const ids = new Set<string>();
  (client?.purchased_services || []).forEach((id: string) => id && ids.add(id));
  (proposals || [])
    .filter(p => p.status === 'accepted')
    .forEach(p => {
      const sel = p.selections;
      if (!sel || typeof sel !== 'object') return;
      SERVICE_ARRAY_KEYS.forEach(key => {
        const arr = sel[key];
        if (Array.isArray(arr)) arr.forEach((id: string) => id && ids.add(id));
      });
    });
  return ids;
}

/** Resolve a template's service id — direct field, else legacy name match. */
function resolveTemplateServiceId(template: AnyRecord, services: AnyRecord[]): string | null {
  if (template.service_id) return template.service_id;
  const name = norm(template.service_name);
  if (!name) return null;
  const match = services.find(s => norm(s.name) === name);
  return match ? match.id : null;
}

/** Pick the best event for a service: next upcoming, else most recent past. */
function bestEventForService(serviceId: string | null, clientEvents: AnyRecord[]): AnyRecord | null {
  if (!serviceId) return null;
  const matched = clientEvents.filter(e => e.service_id === serviceId && e.start_date);
  if (matched.length === 0) return null;
  const now = Date.now();
  const upcoming = matched
    .filter(e => new Date(e.start_date).getTime() >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  if (upcoming.length > 0) return upcoming[0];
  return matched.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
}

function eventFields(event: AnyRecord | null): Record<string, string> {
  if (!event) return { ...TBD };
  const start = event.start_date ? new Date(event.start_date) : null;
  const location = event.location || '';
  const isUrl = typeof location === 'string' && /^https?:\/\//i.test(location);
  const link = event.meeting_link || (isUrl ? location : '');
  return {
    event_date: start
      ? start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
      : TBD.event_date,
    event_time: start && !event.all_day
      ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })
      : (start ? 'All day' : TBD.event_time),
    event_location: location && !isUrl ? location : (link ? 'Online' : TBD.event_location),
    event_link: link || TBD.event_link,
  };
}

function substitute(text: string, values: Record<string, string>): string {
  if (!text) return text;
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  // Neutralize placeholders that have no portal context.
  out = out.split('{{invoice_amount}}').join('[invoice amount]');
  out = out.split('{{invoice_number}}').join('[invoice number]');
  return out;
}

export interface PortalTemplate extends AnyRecord {
  matched_service_id: string | null;
  matched_event_id: string | null;
  event_booked: boolean;
  inclusion_reason: 'service' | 'manual' | 'client_specific';
}

/**
 * Filter + personalize templates for one client's portal.
 * `clientEvents` must already be scoped to this client (and demo-filtered).
 */
export function resolvePortalTemplates(opts: {
  client: AnyRecord;
  proposals: AnyRecord[];
  clientEvents: AnyRecord[];
  templates: AnyRecord[];
  services: AnyRecord[];
}): PortalTemplate[] {
  const { client, proposals, clientEvents, templates, services } = opts;
  const purchased = purchasedServiceIds(client, proposals);
  const manualIds = new Set<string>(client?.portal_template_ids || []);
  const serviceNameMap: Record<string, string> = {};
  services.forEach(s => { serviceNameMap[s.id] = s.name; });

  const result: PortalTemplate[] = [];

  for (const t of templates) {
    const serviceId = resolveTemplateServiceId(t, services);
    const event = bestEventForService(serviceId, clientEvents);

    let reason: PortalTemplate['inclusion_reason'] | null = null;
    // Explicit admin assignment always wins — even over another client's
    // client_id tag (the admin deliberately put it in THIS portal).
    if (manualIds.has(t.id)) reason = 'manual';
    // Otherwise never show another client's template.
    else if (t.client_id && t.client_id !== client.id) continue;
    else if (t.client_id === client.id) reason = 'client_specific';
    else if (serviceId && purchased.has(serviceId) && event) reason = 'service';
    if (!reason) continue;

    const values = {
      client_name: client.name || '',
      company: client.company || client.name || '',
      service_name: (serviceId && serviceNameMap[serviceId]) || t.service_name || '',
      ...eventFields(event),
    };

    result.push({
      ...t,
      version_history: undefined, // internal edit trail — not for portals
      subject: substitute(t.subject || '', values),
      body: substitute(t.body || '', values),
      matched_service_id: serviceId,
      matched_event_id: event ? event.id : null,
      event_booked: !!event,
      inclusion_reason: reason,
    });
  }

  return result;
}
