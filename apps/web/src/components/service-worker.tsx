'use client';

import { useEffect } from 'react';

/**
 * Registers the offline shell only in production builds: caching development
 * chunks would serve stale HMR output. The worker never caches API responses.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    function register(): void {
      void navigator.serviceWorker.register('/sw.js');
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
