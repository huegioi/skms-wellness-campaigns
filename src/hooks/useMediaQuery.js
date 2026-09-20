import { useEffect, useState } from 'react';

/**
 * Reactive CSS media query. Returns true when `query` matches; re-renders on
 * change (window resize, orientation, split-screen). SSR/first-paint safe.
 *
 *   const isWide = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `lg` breakpoint and up — where record dialogs switch to two columns. */
export function useIsWide() {
  return useMediaQuery('(min-width: 1024px)');
}

export default useMediaQuery;
