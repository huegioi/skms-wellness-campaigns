// "Add to calendar" links for Google, Outlook.com and Microsoft 365 — each opens
// the provider's new-event screen pre-filled, so the user just clicks Save.
// Apple Calendar / anything else uses a downloaded .ics (see ics.js).
//
// ev: { title, start, end, location, description }  (start/end: Date | ISO)

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const endOf = (ev) => (ev.end ? toDate(ev.end) : new Date(toDate(ev.start).getTime() + 60 * 60 * 1000));
const gFmt = (d) => toDate(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function googleCalendarUrl(ev) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title || '',
    dates: `${gFmt(ev.start)}/${gFmt(endOf(ev))}`,
    details: ev.description || '',
    location: ev.location || '',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function outlookUrl(host, ev) {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title || '',
    startdt: toDate(ev.start).toISOString(),
    enddt: endOf(ev).toISOString(),
    body: ev.description || '',
    location: ev.location || '',
  });
  return `https://${host}/calendar/0/action/compose?${p.toString()}`;
}

/** Personal Outlook (outlook.com / hotmail / live). */
export const outlookComUrl = (ev) => outlookUrl('outlook.live.com', ev);
/** Work or school Outlook (Microsoft 365). */
export const outlook365Url = (ev) => outlookUrl('outlook.office.com', ev);
