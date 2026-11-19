import type { ReactNode } from 'react';

/**
 * Shared body for route segments that only contribute tab metadata.
 *
 * Each segment still needs its own `layout.tsx` because Next resolves
 * `generateMetadata` per segment, but those layouts add nothing on top of the
 * authenticated shell: they hand `children` straight back. Using one component
 * keeps that decision in a single documented place instead of 18 copies.
 */
export default function RouteShell({ children }: { children: ReactNode }) {
  return children;
}
