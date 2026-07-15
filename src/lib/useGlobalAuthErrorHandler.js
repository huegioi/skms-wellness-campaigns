import { useEffect, useState } from 'react';
import {
  subscribeAuthError,
  reportSessionExpired,
  isAuthError,
  isSessionExpired,
} from '@/lib/authErrorStore';
import { isPublicPath } from '@/lib/publicPaths';

/**
 * Detects auth failures (expired token / lost session) that happen AFTER the
 * initial auth check succeeds — so entity reads that 401 surface as a
 * "Session expired" screen instead of silently empty-state UI.
 *
 * Two capture paths:
 *  1. React Query global onError (see src/lib/query-client.js)
 *  2. window 'unhandledrejection' — catches direct base44.entities.* calls
 *     that pages let bubble (no try/catch).
 *
 * Public paths are excluded so portal/form pages handle their own auth errors.
 */
export function useGlobalAuthErrorHandler() {
  const [sessionExpired, setSessionExpired] = useState(isSessionExpired());

  useEffect(() => {
    const unsub = subscribeAuthError(setSessionExpired);

    const onUnhandledRejection = (event) => {
      if (isPublicPath()) return;
      if (isAuthError(event.reason)) {
        reportSessionExpired();
      }
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      unsub();
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return sessionExpired;
}