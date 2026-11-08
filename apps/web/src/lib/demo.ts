/**
 * Synthetic users created by `prisma/seed.ts`. The ids are public, non-secret
 * demo identifiers used only when the API runs in non-production dev-header
 * mode.
 */
export const DEMO_USERS = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    email: 'admin@demo.nova.local',
    name: 'Admin Demo Aurora',
    role: 'ORG_ADMIN · todas las propiedades',
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    email: 'reception@demo.nova.local',
    name: 'Recepción Demo Centro',
    role: 'Recepción · Centro',
  },
  {
    id: '00000000-0000-4000-8000-000000000013',
    email: 'auditor@demo.nova.local',
    name: 'Auditoría Demo Praia',
    role: 'Auditoría · Praia',
  },
  {
    id: '00000000-0000-4000-8000-000000000016',
    email: 'housekeeper@demo.nova.local',
    name: 'Housekeeping Demo Centro',
    role: 'Housekeeping · Centro',
  },
  {
    id: '00000000-0000-4000-8000-000000000014',
    email: 'admin.b@demo.nova.local',
    name: 'Admin Demo Bosque',
    role: 'ORG_ADMIN · Bosque',
  },
] as const;

export const DEMO_PASSWORD = 'NovaDemo!2026';
