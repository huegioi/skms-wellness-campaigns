import { QR_BASE_URL } from '@/lib/qrLinks';

/**
 * Athletic EQ QR codes (William and Trevon). Each code points at
 * /AthleticEQ?to=<key>, which collects the visitor's details, sends them to the
 * Notion tracker (aeqScanLead) and then forwards to the destination below.
 *
 * Printed codes live forever, so NEVER rename a key once it has been printed.
 * Change the destination instead, and every code already out there follows.
 * Keep the keys in step with base44/functions/aeqScanLead/entry.ts.
 */
export const AEQ_WEBSITE_URL = 'https://courses.skillfulmeans.life/AthleticEQ';

export const AEQ_QR_DESTINATIONS = {
  website: { label: 'the Athletic EQ website', cardLabel: 'Athletic EQ website', url: AEQ_WEBSITE_URL },
  william: { label: "William's LinkedIn", cardLabel: "William's LinkedIn", url: 'https://www.linkedin.com/in/william-jackson-psy-d-b6597644/' },
  trevon: { label: "Trevon's LinkedIn", cardLabel: "Trevon's LinkedIn", url: 'https://www.linkedin.com/in/trevon-bryant-2538bb150' },
};

export const AEQ_ROLES = [
  'Athletic Director or Assistant AD',
  'Head of School or Administrator',
  'Coach',
  'Counselor or Health Staff',
  'Other',
];

/** The URL encoded into the QR code for a destination key. */
export function aeqScanUrl(key) {
  return `${QR_BASE_URL}/AthleticEQ?to=${encodeURIComponent(key)}`;
}
