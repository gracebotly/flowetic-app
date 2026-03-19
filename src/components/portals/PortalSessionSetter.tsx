'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

interface PortalSessionSetterProps {
  portalId: string;
}

/**
 * Invisible client component that fires once when ?subscribed=true
 * and ?email= are present in the URL. Calls POST /api/portal-session
 * to set the session cookie so returning subscribers are auto-redirected.
 *
 * Renders nothing — side-effect only.
 */
export function PortalSessionSetter({ portalId }: PortalSessionSetterProps) {
  const searchParams = useSearchParams();
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;

    const subscribed = searchParams.get('subscribed');
    const email = searchParams.get('email');

    if (subscribed === 'true' && email) {
      hasFired.current = true;
      fetch('/api/portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalId, email }),
      }).catch((err) => {
        console.warn('[PortalSessionSetter] Failed to set session cookie:', err);
      });
    }
  }, [searchParams, portalId]);

  return null;
}
