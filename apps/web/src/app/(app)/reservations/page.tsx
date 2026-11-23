'use client';

import { PropertyGate } from '@/components/app-shell';
import { ReservationsContent } from './_components/reservations-content';

export default function ReservationsPage() {
  return (
    <PropertyGate>
      <ReservationsContent />
    </PropertyGate>
  );
}
