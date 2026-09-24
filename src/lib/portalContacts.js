import { parseOwners } from '@/lib/owners';
import { HEATHER_PHOTO, WILLIAM_PHOTO } from '@/assets/teamPhotos';

/**
 * Who a client sees as "Your SkillfulMeans contact" on the portal Home tab.
 * Keyed by the owner names used on Client.owner ("William", "Heather").
 * photo_url: headshot (src/assets/teamPhotos.js); null falls back to initials.
 */
export const PORTAL_CONTACTS = {
  William: {
    name: 'William Jackson, Psy.D.',
    first: 'William',
    role: 'Co-founder',
    email: 'william@skillfulmeans.life',
    photo_url: WILLIAM_PHOTO,
  },
  Heather: {
    name: 'Heather Wise',
    first: 'Heather',
    role: 'Co-founder',
    email: 'heather@skillfulmeans.life',
    photo_url: HEATHER_PHOTO,
  },
};

export const TEAM_FALLBACK_CONTACT = {
  name: 'The SkillfulMeans team',
  first: 'us',
  role: 'Here to help with anything in your program',
  email: 'admin@skillfulmeans.life',
  photo_url: null,
};

/** Contacts for a client, primary owner first; team inbox when unassigned. */
export function contactsForClient(client) {
  const found = parseOwners(client?.owner)
    .map(o => PORTAL_CONTACTS[Object.keys(PORTAL_CONTACTS).find(k => k.toLowerCase() === o.toLowerCase())])
    .filter(Boolean);
  return found.length ? found.slice(0, 2) : [TEAM_FALLBACK_CONTACT];
}
