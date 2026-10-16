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
  Shemmah: {
    name: 'Shemmah',
    first: 'Shemmah',
    role: '', // title not set yet — the card hides an empty role line
    email: 'admin@skillfulmeans.life',
    photo_url: null, // initials until a headshot is added to src/assets/teamPhotos.js
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
 * The HR (client) portal contact is ALWAYS Shemmah at admin@ (William,
 * 2026-10-16; was Heather), regardless of who owns the client record. Used by
 * the client portal Home contact card, the portal footer, and the Emails tab.
 */
export const HR_PORTAL_CONTACT = PORTAL_CONTACTS.Shemmah;

export function contactsForClient() {
  return [HR_PORTAL_CONTACT];
}

/** Referral partner portal contact — Heather (unchanged 2026-10-16). */
export const PARTNER_PORTAL_CONTACT = PORTAL_CONTACTS.Heather;

/** Public QuickBuilder "Book a call / Book a Free Demo" card — Heather runs demos. */
export const DEMO_CALL_CONTACT = PORTAL_CONTACTS.Heather;
