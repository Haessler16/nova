'use client';

import { useState } from 'react';

/** Tracks which front-office action is in flight, keyed by action + entity. */
export function useBusy() {
  const [busy, setBusy] = useState<string | null>(null);
  return { busy, setBusy };
}
