/**
 * Lightweight pub/sub store for the Maya Orb launcher.
 *
 * - Tracks which CRM record the user is currently viewing (for the contextual
 *   "Want my read on <name>?" bubble).
 * - Tracks session-level dismissal state for greeting / context bubbles so
 *   they never reappear after being dismissed within the same browser session.
 *
 * Uses sessionStorage so state survives SPA navigation but resets when the
 * tab closes — matching the "once per session" requirement.
 */

const RECORD_KEY = 'mayaOrb_recordContext';
const GREETING_KEY = 'mayaOrb_greetingDismissed';
const CONTEXT_KEY = 'mayaOrb_contextDismissed';

const listeners = new Set();

function notify() {
  const ctx = getRecordContext();
  listeners.forEach((fn) => fn(ctx));
}

export function getRecordContext() {
  try {
    const raw = sessionStorage.getItem(RECORD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setMayaRecordContext({ recordType, recordId, recordName }) {
  try {
    sessionStorage.setItem(
      RECORD_KEY,
      JSON.stringify({ recordType, recordId, recordName })
    );
  } catch {
    /* ignore */
  }
  notify();
}

export function clearMayaRecordContext() {
  try {
    sessionStorage.removeItem(RECORD_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export function isGreetingDismissed() {
  try {
    return sessionStorage.getItem(GREETING_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissGreeting() {
  try {
    sessionStorage.setItem(GREETING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isContextDismissed() {
  try {
    return sessionStorage.getItem(CONTEXT_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissContext() {
  try {
    sessionStorage.setItem(CONTEXT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function subscribeMayaOrb(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}