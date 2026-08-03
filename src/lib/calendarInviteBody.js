export const APP_BASE_URL = 'https://app.skillfulmeans.life';

export function buildCheckinUrl(event) {
  if (!event?.checkin_token) return null;
  return `${APP_BASE_URL}/Checkin?t=${event.checkin_token}`;
}

export function buildInviteDescription(event, service) {
  const parts = [];
  const checkinUrl = buildCheckinUrl(event);
  if (checkinUrl) {
    parts.push('CHECK IN HERE:');
    parts.push(checkinUrl);
    parts.push('Please check in at this link when the session starts. Your video link will appear right after you check in.');
    parts.push('');
  }
  if (service?.description) parts.push(service.description);
  else if (service?.short_description) parts.push(service.short_description);
  if (service?.key_benefits?.length) {
    parts.push('');
    parts.push('Key Benefits:');
    service.key_benefits.forEach(b => parts.push('• ' + b));
  }
  if (event?.description) {
    const existing = String(event.description).trim();
    // Don't duplicate service copy that's already stored on the event
    if (existing && !parts.join('\n').includes(existing)) {
      parts.push('');
      parts.push(existing);
    }
  }
  parts.push('');
  parts.push('— SkillfulMeans Wellness Services');
  return parts.join('\n').trim();
}

// RFC 5545: escape backslash, semicolon, comma, newline; then fold at 75 octets.
export function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function icsFold(line) {
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) { out.push(' ' + rest.slice(0, 74)); rest = rest.slice(74); }
  if (rest.length) out.push(' ' + rest);
  return out.join('\r\n');
}