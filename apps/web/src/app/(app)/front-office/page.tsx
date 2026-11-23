'use client';

import { PropertyGate } from '@/components/app-shell';
import { FrontOfficeContent } from './_components/front-office-content';

export default function FrontOfficePage() {
  return (
    <PropertyGate>
      <FrontOfficeContent />
    </PropertyGate>
  );
}
