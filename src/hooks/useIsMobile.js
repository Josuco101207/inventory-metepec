import { useSyncExternalStore } from 'react';

/**
 * Centralized mobile detection hook.
 * Uses matchMedia for reliable detection (viewport + touch pointer).
 * useSyncExternalStore ensures no tearing during concurrent rendering.
 */

const MOBILE_QUERY = '(max-width: 768px)';
const TABLET_QUERY = '(min-width: 769px) and (max-width: 1024px)';

function createMediaStore(query) {
  let listeners = [];

  function getSnapshot() {
    return window.matchMedia(query).matches;
  }

  function getServerSnapshot() {
    return false;
  }

  function subscribe(callback) {
    const mql = window.matchMedia(query);
    const handler = () => callback();
    mql.addEventListener('change', handler);
    listeners.push({ mql, handler });
    return () => {
      mql.removeEventListener('change', handler);
      listeners = listeners.filter(l => l.handler !== handler);
    };
  }

  return { getSnapshot, getServerSnapshot, subscribe };
}

const mobileStore = createMediaStore(MOBILE_QUERY);
const tabletStore = createMediaStore(TABLET_QUERY);

/**
 * @returns {{ isMobile: boolean, isTablet: boolean, isDesktop: boolean }}
 */
export function useIsMobile() {
  const isMobile = useSyncExternalStore(
    mobileStore.subscribe,
    mobileStore.getSnapshot,
    mobileStore.getServerSnapshot
  );

  const isTablet = useSyncExternalStore(
    tabletStore.subscribe,
    tabletStore.getSnapshot,
    tabletStore.getServerSnapshot
  );

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
  };
}

export default useIsMobile;
