// src/lib/ics.js
// Builds a valid iCalendar (.ics) VCALENDAR/VEVENT string and triggers a download.

function escapeICS(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toICSDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  // ISO string -> YYYYMMDDTHHMMSSZ (UTC)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Build a VCALENDAR/VEVENT string.
 * @param {Object} e - { id, title, start, end, location, description }
 * @returns {string} ICS file contents
 */
export function buildICS({ id, title, start, end, location, description }) {
  const dtStart = toICSDate(start);
  const dtEnd = end
    ? toICSDate(end)
    : toICSDate(new Date(new Date(start).getTime() + 60 * 60 * 1000));
  const dtStamp = toICSDate(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkillfulMeans//Portal//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${id || dtStamp}@skms-wellness`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(title)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    description ? `DESCRIPTION:${escapeICS(description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

/**
 * Build an ICS string for the event and trigger a browser download.
 * @param {Object} eventData - { id, title, start, end, location, description }
 */
export function downloadICS(eventData) {
  const ics = buildICS(eventData);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(eventData.title || 'event').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}