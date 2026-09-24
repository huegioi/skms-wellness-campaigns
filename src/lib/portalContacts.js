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

/**
 * The HR (client) portal contact is ALWAYS Heather (William, 2026-09-24),
 * regardless of who owns the client record. Change it here to change it
 * everywhere in the client portal.
 */
export const HR_PORTAL_CONTACT = PORTAL_CONTACTS.Heather;

export function contactsForClient() {
  return [HR_PORTAL_CONTACT];
}
