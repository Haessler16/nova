import {
  PrismaClient,
  RecordStatus,
  HousekeepingState,
  RoomOperationalState,
  GuestDocumentType,
  ReservationStatus,
  StayStatus,
} from '@prisma/client';
import { createHash, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

/**
 * Deterministic, synthetic development data. No real guest, employee or
 * document data is used. Safe to run repeatedly (`upsert` based).
 *
 * Every demo user signs in with the same password. The hash itself is
 * deterministic per email so re-seeding does not unexpectedly change stored
 * credentials, while still using a distinct salt per user.
 */
const DEMO_PASSWORD = 'NovaDemo!2026';

const IDS = {
  organizationA: '00000000-0000-4000-8000-000000000001',
  propertyCentro: '00000000-0000-4000-8000-000000000002',
  propertyPraia: '00000000-0000-4000-8000-000000000003',
  organizationB: '00000000-0000-4000-8000-000000000004',
  propertyBosque: '00000000-0000-4000-8000-000000000005',

  userAdmin: '00000000-0000-4000-8000-000000000011',
  userReception: '00000000-0000-4000-8000-000000000012',
  userAuditor: '00000000-0000-4000-8000-000000000013',
  userAdminB: '00000000-0000-4000-8000-000000000014',
  userDisabled: '00000000-0000-4000-8000-000000000015',
  userHousekeeper: '00000000-0000-4000-8000-000000000016',

  roleAdminA: '00000000-0000-4000-8000-000000000021',
  roleManagerA: '00000000-0000-4000-8000-000000000022',
  roleReceptionA: '00000000-0000-4000-8000-000000000023',
  roleAuditorA: '00000000-0000-4000-8000-000000000024',
  roleAdminB: '00000000-0000-4000-8000-000000000025',
  roleHousekeeperA: '00000000-0000-4000-8000-000000000026',

  permissionPropertyRead: '00000000-0000-4000-8000-000000000031',
  permissionPropertyManage: '00000000-0000-4000-8000-000000000032',
  permissionAuditRead: '00000000-0000-4000-8000-000000000033',
  permissionOrganizationPropertiesManage: '00000000-0000-4000-8000-000000000034',
  permissionInventoryRead: '00000000-0000-4000-8000-000000000035',
  permissionInventoryManage: '00000000-0000-4000-8000-000000000036',
  permissionHousekeepingManage: '00000000-0000-4000-8000-000000000037',
  permissionOrganizationMembersRead: '00000000-0000-4000-8000-000000000038',
  permissionOrganizationMembersManage: '00000000-0000-4000-8000-000000000039',
  permissionOrganizationRolesRead: '00000000-0000-4000-8000-000000000040',
  permissionOrganizationRolesManage: '00000000-0000-4000-8000-000000000041',
  permissionSecurityEventsRead: '00000000-0000-4000-8000-000000000042',
  permissionGuestsRead: '00000000-0000-4000-8000-000000000043',
  permissionGuestsManage: '00000000-0000-4000-8000-000000000044',
  permissionReservationsRead: '00000000-0000-4000-8000-000000000045',
  permissionReservationsManage: '00000000-0000-4000-8000-000000000046',
  permissionFrontOfficeRead: '00000000-0000-4000-8000-000000000047',
  permissionFrontOfficeManage: '00000000-0000-4000-8000-000000000048',
  permissionIncidentsRead: '00000000-0000-4000-8000-000000000049',
  permissionIncidentsManage: '00000000-0000-4000-8000-000000000050',
  permissionFolioRead: '00000000-0000-4000-8000-000000000051',
  permissionFolioManage: '00000000-0000-4000-8000-000000000052',
  permissionPaymentRead: '00000000-0000-4000-8000-000000000053',
  permissionPaymentManage: '00000000-0000-4000-8000-000000000054',
  permissionCashRead: '00000000-0000-4000-8000-000000000055',
  permissionCashManage: '00000000-0000-4000-8000-000000000056',
  permissionNightAuditRead: '00000000-0000-4000-8000-000000000057',
  permissionNightAuditManage: '00000000-0000-4000-8000-000000000058',
  permissionPilotFeedbackSubmit: '00000000-0000-4000-8000-000000000059',
  permissionPilotFeedbackRead: '00000000-0000-4000-8000-000000000060',
  permissionPilotFeedbackManage: '00000000-0000-4000-8000-000000000061',
  permissionDocumentsRead: '00000000-0000-4000-8000-000000000090',
  permissionDocumentsGenerate: '00000000-0000-4000-8000-000000000091',
  permissionDocumentsManage: '00000000-0000-4000-8000-000000000092',
  permissionReportsRead: '00000000-0000-4000-8000-000000000093',
  permissionReportsFinancial: '00000000-0000-4000-8000-000000000094',

  guestAna: '00000000-0000-4000-8000-000000000061',
  guestBruno: '00000000-0000-4000-8000-000000000062',
  guestCarla: '00000000-0000-4000-8000-000000000063',
  guestDiego: '00000000-0000-4000-8000-000000000071',
  guestElisa: '00000000-0000-4000-8000-000000000072',
  guestFelipe: '00000000-0000-4000-8000-000000000073',
  guestGabriela: '00000000-0000-4000-8000-000000000074',
  guestHenrique: '00000000-0000-4000-8000-000000000075',
  guestIsabela: '00000000-0000-4000-8000-000000000076',

  roomTypeCentroStandard: '00000000-0000-4000-8000-000000000041',
  roomTypeCentroDeluxe: '00000000-0000-4000-8000-000000000042',
  roomTypePraiaStandard: '00000000-0000-4000-8000-000000000043',

  roomCentro101: '00000000-0000-4000-8000-000000000051',
  roomCentro102: '00000000-0000-4000-8000-000000000052',
  roomCentro103: '00000000-0000-4000-8000-000000000053',
  roomCentro201: '00000000-0000-4000-8000-000000000054',
  roomPraia101: '00000000-0000-4000-8000-000000000055',
  roomPraia102: '00000000-0000-4000-8000-000000000056',
  roomCentro104: '00000000-0000-4000-8000-000000000057',
  roomCentro105: '00000000-0000-4000-8000-000000000058',
  roomCentro202: '00000000-0000-4000-8000-000000000059',

  reservationInHouse1: '00000000-0000-4000-8000-000000000101',
  reservationInHouse2: '00000000-0000-4000-8000-000000000102',
  reservationArrivalToday: '00000000-0000-4000-8000-000000000103',
  reservationUnassignedToday: '00000000-0000-4000-8000-000000000104',
  reservationDepartureToday: '00000000-0000-4000-8000-000000000105',
  reservationFuture1: '00000000-0000-4000-8000-000000000106',
  reservationPastStay: '00000000-0000-4000-8000-000000000107',
  reservationFuture2: '00000000-0000-4000-8000-000000000108',
} as const;

const PROPERTY_TIMEZONE = 'America/Sao_Paulo';

/**
 * Demo stays are relative to the property's local calendar date so the seed
 * always produces arrivals, departures and in-house stays for "today".
 */
function demoCalendarDate(offsetDays = 0): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((item) => item.type === type)?.value);
  const base = Date.UTC(part('year'), part('month') - 1, part('day'));
  return new Date(base + offsetDays * 86_400_000);
}

function demoInstant(offsetDays = 0, hour = 15): Date {
  return new Date(demoCalendarDate(offsetDays).getTime() + hour * 3_600_000);
}

const PERMISSIONS = [
  {
    id: IDS.permissionPropertyRead,
    key: 'property.read',
    description: 'Read property configuration and summaries',
  },
  {
    id: IDS.permissionPropertyManage,
    key: 'property.manage',
    description: 'Update property settings and manage property-scoped configuration',
  },
  {
    id: IDS.permissionOrganizationPropertiesManage,
    key: 'organization.properties.manage',
    description: 'Create properties and administer them across the organization',
  },
  {
    id: IDS.permissionAuditRead,
    key: 'audit.read',
    description: 'Read append-only audit events for a property',
  },
  {
    id: IDS.permissionInventoryRead,
    key: 'inventory.read',
    description: 'Read room types, rooms, blocks and room state history',
  },
  {
    id: IDS.permissionInventoryManage,
    key: 'inventory.manage',
    description: 'Create and update room types, rooms and operational blocks',
  },
  {
    id: IDS.permissionHousekeepingManage,
    key: 'housekeeping.manage',
    description: 'Transition room housekeeping state',
  },
  {
    id: IDS.permissionOrganizationMembersRead,
    key: 'organization.members.read',
    description: 'List organization and property memberships',
  },
  {
    id: IDS.permissionOrganizationMembersManage,
    key: 'organization.members.manage',
    description: 'Invite, update and deactivate organization memberships',
  },
  {
    id: IDS.permissionOrganizationRolesRead,
    key: 'organization.roles.read',
    description: 'List organization roles and their permissions',
  },
  {
    id: IDS.permissionOrganizationRolesManage,
    key: 'organization.roles.manage',
    description: 'Create and update custom organization roles',
  },
  {
    id: IDS.permissionSecurityEventsRead,
    key: 'security.events.read',
    description: 'Read authentication and authorization security events',
  },
  {
    id: IDS.permissionGuestsRead,
    key: 'guests.read',
    description: 'Read guest profiles and reservations guest data',
  },
  {
    id: IDS.permissionGuestsManage,
    key: 'guests.manage',
    description: 'Create and update guest profiles',
  },
  {
    id: IDS.permissionReservationsRead,
    key: 'reservations.read',
    description: 'Read reservations, availability and reservation history',
  },
  {
    id: IDS.permissionReservationsManage,
    key: 'reservations.manage',
    description: 'Create, modify, assign and cancel reservations',
  },
  {
    id: IDS.permissionFrontOfficeRead,
    key: 'front_office.read',
    description: 'Read the room rack, arrivals, departures and in-house stays',
  },
  {
    id: IDS.permissionFrontOfficeManage,
    key: 'front_office.manage',
    description: 'Check guests in/out, move rooms and mark no-shows',
  },
  {
    id: IDS.permissionIncidentsRead,
    key: 'incidents.read',
    description: 'Read operational notes and incidents',
  },
  {
    id: IDS.permissionIncidentsManage,
    key: 'incidents.manage',
    description: 'Create and resolve operational notes and incidents',
  },
  {
    id: IDS.permissionFolioRead,
    key: 'folio.read',
    description: 'Read folios, charges and balances',
  },
  {
    id: IDS.permissionFolioManage,
    key: 'folio.manage',
    description: 'Open folios, post charges and close or cancel accounts',
  },
  {
    id: IDS.permissionPaymentRead,
    key: 'payment.read',
    description: 'Read payments recorded against folios',
  },
  {
    id: IDS.permissionPaymentManage,
    key: 'payment.manage',
    description: 'Record and refund folio payments without storing card data',
  },
  {
    id: IDS.permissionCashRead,
    key: 'cash.read',
    description: 'Read cash sessions and cash movements',
  },
  {
    id: IDS.permissionCashManage,
    key: 'cash.manage',
    description: 'Open/close cash sessions and record cash movements',
  },
  {
    id: IDS.permissionNightAuditRead,
    key: 'night_audit.read',
    description: 'Read operational close and night audit snapshots',
  },
  {
    id: IDS.permissionNightAuditManage,
    key: 'night_audit.manage',
    description: 'Run and reopen the operational day close',
  },
  {
    id: IDS.permissionPilotFeedbackSubmit,
    key: 'pilot.feedback.submit',
    description: 'Submit pilot feedback from the property',
  },
  {
    id: IDS.permissionPilotFeedbackRead,
    key: 'pilot.feedback.read',
    description: 'Read pilot feedback for the property',
  },
  {
    id: IDS.permissionPilotFeedbackManage,
    key: 'pilot.feedback.manage',
    description: 'Review pilot feedback for the property',
  },
  {
    id: IDS.permissionDocumentsRead,
    key: 'documents.read',
    description: 'Read templates, document history and generated document metadata',
  },
  {
    id: IDS.permissionDocumentsGenerate,
    key: 'documents.generate',
    description: 'Preview and generate guest documents and download their PDFs',
  },
  {
    id: IDS.permissionDocumentsManage,
    key: 'documents.manage',
    description: 'Register physical signature receipt and print/reprint events',
  },
  {
    id: IDS.permissionReportsRead,
    key: 'reports.read',
    description: 'Read the operational report catalog and run non-financial reports',
  },
  {
    id: IDS.permissionReportsFinancial,
    key: 'reports.financial',
    description: 'Run and export cash and financial reports',
  },
] as const;

const ALL_PERMISSION_IDS = PERMISSIONS.map((permission) => permission.id);

const ROLES = [
  {
    id: IDS.roleAdminA,
    organizationId: IDS.organizationA,
    key: 'ORG_ADMIN',
    name: 'Organization administrator',
    system: true,
    permissions: ALL_PERMISSION_IDS,
  },
  {
    id: IDS.roleManagerA,
    organizationId: IDS.organizationA,
    key: 'PROPERTY_MANAGER',
    name: 'Property manager',
    system: true,
    permissions: [
      IDS.permissionPropertyRead,
      IDS.permissionPropertyManage,
      IDS.permissionOrganizationPropertiesManage,
      IDS.permissionOrganizationMembersRead,
      IDS.permissionOrganizationMembersManage,
      IDS.permissionOrganizationRolesRead,
      IDS.permissionAuditRead,
      IDS.permissionSecurityEventsRead,
      IDS.permissionInventoryRead,
      IDS.permissionInventoryManage,
      IDS.permissionHousekeepingManage,
      IDS.permissionGuestsRead,
      IDS.permissionGuestsManage,
      IDS.permissionReservationsRead,
      IDS.permissionReservationsManage,
      IDS.permissionFrontOfficeRead,
      IDS.permissionFrontOfficeManage,
      IDS.permissionIncidentsRead,
      IDS.permissionIncidentsManage,
      IDS.permissionFolioRead,
      IDS.permissionFolioManage,
      IDS.permissionPaymentRead,
      IDS.permissionPaymentManage,
      IDS.permissionCashRead,
      IDS.permissionCashManage,
      IDS.permissionNightAuditRead,
      IDS.permissionNightAuditManage,
      IDS.permissionPilotFeedbackSubmit,
      IDS.permissionPilotFeedbackRead,
      IDS.permissionPilotFeedbackManage,
      IDS.permissionDocumentsRead,
      IDS.permissionDocumentsGenerate,
      IDS.permissionDocumentsManage,
      IDS.permissionReportsRead,
      IDS.permissionReportsFinancial,
    ],
  },
  {
    id: IDS.roleReceptionA,
    organizationId: IDS.organizationA,
    key: 'RECEPTIONIST',
    name: 'Receptionist',
    system: true,
    permissions: [
      IDS.permissionPropertyRead,
      IDS.permissionInventoryRead,
      IDS.permissionHousekeepingManage,
      IDS.permissionGuestsRead,
      IDS.permissionGuestsManage,
      IDS.permissionReservationsRead,
      IDS.permissionReservationsManage,
      IDS.permissionFrontOfficeRead,
      IDS.permissionFrontOfficeManage,
      IDS.permissionIncidentsRead,
      IDS.permissionIncidentsManage,
      IDS.permissionFolioRead,
      IDS.permissionFolioManage,
      IDS.permissionPaymentRead,
      IDS.permissionPaymentManage,
      IDS.permissionCashRead,
      IDS.permissionCashManage,
      IDS.permissionPilotFeedbackSubmit,
      IDS.permissionDocumentsRead,
      IDS.permissionDocumentsGenerate,
      IDS.permissionDocumentsManage,
      IDS.permissionReportsRead,
    ],
  },
  {
    id: IDS.roleAuditorA,
    organizationId: IDS.organizationA,
    key: 'AUDITOR',
    name: 'Auditor / finance',
    system: true,
    permissions: [
      IDS.permissionPropertyRead,
      IDS.permissionAuditRead,
      IDS.permissionInventoryRead,
      IDS.permissionGuestsRead,
      IDS.permissionReservationsRead,
      IDS.permissionFrontOfficeRead,
      IDS.permissionIncidentsRead,
      IDS.permissionFolioRead,
      IDS.permissionPaymentRead,
      IDS.permissionCashRead,
      IDS.permissionNightAuditRead,
      IDS.permissionNightAuditManage,
      IDS.permissionPilotFeedbackSubmit,
      IDS.permissionPilotFeedbackRead,
      IDS.permissionDocumentsRead,
      IDS.permissionReportsRead,
      IDS.permissionReportsFinancial,
    ],
  },
  {
    id: IDS.roleHousekeeperA,
    organizationId: IDS.organizationA,
    key: 'HOUSEKEEPER',
    name: 'Housekeeper',
    system: true,
    permissions: [
      IDS.permissionPropertyRead,
      IDS.permissionInventoryRead,
      IDS.permissionHousekeepingManage,
      IDS.permissionFrontOfficeRead,
      IDS.permissionIncidentsRead,
      IDS.permissionPilotFeedbackSubmit,
    ],
  },
  {
    id: IDS.roleAdminB,
    organizationId: IDS.organizationB,
    key: 'ORG_ADMIN',
    name: 'Organization administrator',
    system: true,
    permissions: ALL_PERMISSION_IDS,
  },
] as const;

function demoPasswordHash(email: string): string {
  const salt = createHash('sha256')
    .update(`nova-demo-password:${email}`, 'utf8')
    .digest()
    .subarray(0, 16);
  const derived = scryptSync(DEMO_PASSWORD, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function seed(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  await prisma.organization.upsert({
    where: { slug: 'aurora-demo' },
    update: { name: 'Aurora Demo Hotels', status: RecordStatus.ACTIVE },
    create: {
      id: IDS.organizationA,
      name: 'Aurora Demo Hotels',
      slug: 'aurora-demo',
      status: RecordStatus.ACTIVE,
    },
  });

  await prisma.organization.upsert({
    where: { slug: 'bosque-demo' },
    update: { name: 'Bosque Demo Hotels', status: RecordStatus.ACTIVE },
    create: {
      id: IDS.organizationB,
      name: 'Bosque Demo Hotels',
      slug: 'bosque-demo',
      status: RecordStatus.ACTIVE,
    },
  });

  await prisma.property.upsert({
    where: { organizationId_code: { organizationId: IDS.organizationA, code: 'CENTRO' } },
    update: { name: 'Aurora Centro (demo)' },
    create: {
      id: IDS.propertyCentro,
      organizationId: IDS.organizationA,
      name: 'Aurora Centro (demo)',
      code: 'CENTRO',
      timezone: 'America/Sao_Paulo',
      currencyCode: 'BRL',
      operationalDayStart: '06:00',
      status: RecordStatus.ACTIVE,
    },
  });

  await prisma.property.upsert({
    where: { organizationId_code: { organizationId: IDS.organizationA, code: 'PRAIA' } },
    update: { name: 'Aurora Praia (demo)' },
    create: {
      id: IDS.propertyPraia,
      organizationId: IDS.organizationA,
      name: 'Aurora Praia (demo)',
      code: 'PRAIA',
      timezone: 'America/Sao_Paulo',
      currencyCode: 'BRL',
      operationalDayStart: '06:00',
      status: RecordStatus.ACTIVE,
    },
  });

  await prisma.property.upsert({
    where: { organizationId_code: { organizationId: IDS.organizationB, code: 'BOSQUE' } },
    update: { name: 'Bosque Demo (demo)' },
    create: {
      id: IDS.propertyBosque,
      organizationId: IDS.organizationB,
      name: 'Bosque Demo (demo)',
      code: 'BOSQUE',
      timezone: 'America/Sao_Paulo',
      currencyCode: 'BRL',
      operationalDayStart: '06:00',
      status: RecordStatus.ACTIVE,
    },
  });

  const users = [
    {
      id: IDS.userAdmin,
      email: 'admin@demo.nova.local',
      name: 'Admin Demo Aurora',
      status: RecordStatus.ACTIVE,
    },
    {
      id: IDS.userReception,
      email: 'reception@demo.nova.local',
      name: 'Recepción Demo Centro',
      status: RecordStatus.ACTIVE,
    },
    {
      id: IDS.userAuditor,
      email: 'auditor@demo.nova.local',
      name: 'Auditoría Demo Praia',
      status: RecordStatus.ACTIVE,
    },
    {
      id: IDS.userAdminB,
      email: 'admin.b@demo.nova.local',
      name: 'Admin Demo Bosque',
      status: RecordStatus.ACTIVE,
    },
    {
      id: IDS.userDisabled,
      email: 'disabled@demo.nova.local',
      name: 'Usuario Deshabilitado Demo',
      status: RecordStatus.DISABLED,
    },
    {
      id: IDS.userHousekeeper,
      email: 'housekeeper@demo.nova.local',
      name: 'Housekeeping Demo Centro',
      status: RecordStatus.ACTIVE,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        status: user.status,
        passwordHash: demoPasswordHash(user.email),
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
        mfaEnabled: false,
        mfaSecret: null,
        mfaEnrolledAt: null,
        mfaLastUsedStep: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        ...user,
        passwordHash: demoPasswordHash(user.email),
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  }

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { organizationId_key: { organizationId: role.organizationId, key: role.key } },
      update: { name: role.name, system: role.system },
      create: {
        id: role.id,
        organizationId: role.organizationId,
        key: role.key,
        name: role.name,
        system: role.system,
      },
    });

    // Seed-managed permissions are authoritative for demo roles; removing and
    // recreating keeps re-runs exact instead of accumulating stale grants.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: role.permissions.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  const memberships = [
    {
      organizationId: IDS.organizationA,
      userId: IDS.userAdmin,
      roleId: IDS.roleAdminA,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationA,
      userId: IDS.userReception,
      roleId: null,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationA,
      userId: IDS.userAuditor,
      roleId: null,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationA,
      userId: IDS.userDisabled,
      roleId: null,
      status: RecordStatus.SUSPENDED,
    },
    {
      organizationId: IDS.organizationA,
      userId: IDS.userHousekeeper,
      roleId: null,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationB,
      userId: IDS.userAdminB,
      roleId: IDS.roleAdminB,
      status: RecordStatus.ACTIVE,
    },
  ];

  for (const membership of memberships) {
    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: membership.organizationId,
          userId: membership.userId,
        },
      },
      update: { status: membership.status, roleId: membership.roleId },
      create: membership,
    });
  }

  const propertyMemberships = [
    {
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      userId: IDS.userAdmin,
      roleId: IDS.roleAdminA,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyPraia,
      userId: IDS.userAdmin,
      roleId: IDS.roleAdminA,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      userId: IDS.userReception,
      roleId: IDS.roleReceptionA,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyPraia,
      userId: IDS.userAuditor,
      roleId: IDS.roleAuditorA,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      userId: IDS.userHousekeeper,
      roleId: IDS.roleHousekeeperA,
      status: RecordStatus.ACTIVE,
    },
    {
      organizationId: IDS.organizationB,
      propertyId: IDS.propertyBosque,
      userId: IDS.userAdminB,
      roleId: IDS.roleAdminB,
      status: RecordStatus.ACTIVE,
    },
  ];

  for (const propertyMembership of propertyMemberships) {
    await prisma.propertyMembership.upsert({
      where: {
        propertyId_userId: {
          propertyId: propertyMembership.propertyId,
          userId: propertyMembership.userId,
        },
      },
      update: {
        organizationId: propertyMembership.organizationId,
        roleId: propertyMembership.roleId,
        status: propertyMembership.status,
      },
      create: propertyMembership,
    });
  }

  const roomTypes = [
    {
      id: IDS.roomTypeCentroStandard,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      name: 'Standard',
      code: 'STD',
      description: 'Synthetic standard room',
      capacityAdults: 2,
      capacityChildren: 1,
      bedType: 'Queen',
    },
    {
      id: IDS.roomTypeCentroDeluxe,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      name: 'Deluxe',
      code: 'DLX',
      description: 'Synthetic deluxe room',
      capacityAdults: 3,
      capacityChildren: 1,
      bedType: 'King',
    },
    {
      id: IDS.roomTypePraiaStandard,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyPraia,
      name: 'Standard',
      code: 'STD',
      description: 'Synthetic beach standard room',
      capacityAdults: 2,
      capacityChildren: 1,
      bedType: 'Queen',
    },
  ];

  for (const roomType of roomTypes) {
    await prisma.roomType.upsert({
      where: {
        propertyId_code: { propertyId: roomType.propertyId, code: roomType.code },
      },
      update: {
        name: roomType.name,
        description: roomType.description,
        capacityAdults: roomType.capacityAdults,
        capacityChildren: roomType.capacityChildren,
        bedType: roomType.bedType,
        status: RecordStatus.ACTIVE,
      },
      create: { ...roomType, status: RecordStatus.ACTIVE },
    });
  }

  const rooms = [
    {
      id: IDS.roomCentro101,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      roomTypeId: IDS.roomTypeCentroStandard,
      number: '101',
      floor: '1',
      building: 'Main',
      attributes: ['balcony', 'accessible'],
      housekeepingState: HousekeepingState.CLEAN,
    },
    {
      id: IDS.roomCentro102,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      roomTypeId: IDS.roomTypeCentroStandard,
      number: '102',
      floor: '1',
      building: 'Main',
      attributes: ['quiet'],
      housekeepingState: HousekeepingState.DIRTY,
    },
    {
      id: IDS.roomCentro103,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      roomTypeId: IDS.roomTypeCentroStandard,
      number: '103',
      floor: '1',
      building: 'Main',
      attributes: [],
      housekeepingState: HousekeepingState.INSPECTED,
    },
    {
      id: IDS.roomCentro201,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      roomTypeId: IDS.roomTypeCentroDeluxe,
      number: '201',
      floor: '2',
      building: 'Main',
      attributes: ['balcony', 'corner'],
      housekeepingState: HousekeepingState.CLEAN,
    },
    {
      id: IDS.roomCentro104,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      roomTypeId: IDS.roomTypeCentroStandard,
      number: '104',
      floor: '1',
      building: 'Main',
      attributes: ['quiet'],
      housekeepingState: HousekeepingState.CLEAN,
    },
    {
      id: IDS.roomCentro105,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      roomTypeId: IDS.roomTypeCentroStandard,
      number: '105',
      floor: '1',
      building: 'Main',
      attributes: [],
      housekeepingState: HousekeepingState.CLEAN,
    },
    {
      id: IDS.roomCentro202,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      roomTypeId: IDS.roomTypeCentroDeluxe,
      number: '202',
      floor: '2',
      building: 'Main',
      attributes: ['balcony'],
      housekeepingState: HousekeepingState.CLEAN,
    },
    {
      id: IDS.roomPraia101,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyPraia,
      roomTypeId: IDS.roomTypePraiaStandard,
      number: '101',
      floor: '1',
      building: 'Beach',
      attributes: ['sea-view'],
      housekeepingState: HousekeepingState.CLEAN,
    },
    {
      id: IDS.roomPraia102,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyPraia,
      roomTypeId: IDS.roomTypePraiaStandard,
      number: '102',
      floor: '1',
      building: 'Beach',
      attributes: ['sea-view'],
      housekeepingState: HousekeepingState.DIRTY,
    },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { propertyId_number: { propertyId: room.propertyId, number: room.number } },
      update: {
        roomTypeId: room.roomTypeId,
        floor: room.floor,
        building: room.building,
        attributes: room.attributes,
        housekeepingState: room.housekeepingState,
        operationalState: RoomOperationalState.AVAILABLE,
        status: RecordStatus.ACTIVE,
      },
      create: {
        ...room,
        operationalState: RoomOperationalState.AVAILABLE,
        status: RecordStatus.ACTIVE,
      },
    });
  }

  const guests = [
    {
      id: IDS.guestAna,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Ana Souza (demo)',
      email: 'ana.souza@demo.nova.local',
      phone: '+55 11 90000-0001',
      documentType: GuestDocumentType.PASSPORT,
      documentNumber: 'DEMO-P-0001',
      notes: 'Synthetic demo guest. No real personal data.',
    },
    {
      id: IDS.guestBruno,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Bruno Lima (demo)',
      email: 'bruno.lima@demo.nova.local',
      phone: '+55 11 90000-0002',
      documentType: null,
      documentNumber: null,
      notes: 'Synthetic demo guest. No real personal data.',
    },
    {
      id: IDS.guestCarla,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyPraia,
      fullName: 'Carla Mendes (demo)',
      email: 'carla.mendes@demo.nova.local',
      phone: '+55 21 90000-0003',
      documentType: GuestDocumentType.NATIONAL_ID,
      documentNumber: 'DEMO-RG-0003',
      notes: 'Synthetic demo guest. No real personal data.',
    },
    {
      id: IDS.guestDiego,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Diego Almeida (demo)',
      email: 'diego.almeida@demo.nova.local',
      phone: '+55 11 90000-0004',
      documentType: GuestDocumentType.PASSPORT,
      documentNumber: 'DEMO-P-0004',
      notes: 'Synthetic demo guest. Early breakfast requested.',
    },
    {
      id: IDS.guestElisa,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Elisa Prado (demo)',
      email: 'elisa.prado@demo.nova.local',
      phone: '+55 11 90000-0005',
      documentType: GuestDocumentType.NATIONAL_ID,
      documentNumber: 'DEMO-RG-0005',
      notes: 'Synthetic demo guest. No real personal data.',
    },
    {
      id: IDS.guestFelipe,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Felipe Rocha (demo)',
      email: 'felipe.rocha@demo.nova.local',
      phone: '+55 11 90000-0006',
      documentType: null,
      documentNumber: null,
      notes: 'Synthetic demo guest. Departing today.',
    },
    {
      id: IDS.guestGabriela,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Gabriela Nunes (demo)',
      email: 'gabriela.nunes@demo.nova.local',
      phone: '+55 11 90000-0007',
      documentType: GuestDocumentType.DRIVER_LICENSE,
      documentNumber: 'DEMO-CNH-0007',
      notes: 'Synthetic demo guest. No real personal data.',
    },
    {
      id: IDS.guestHenrique,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Henrique Dias (demo)',
      email: 'henrique.dias@demo.nova.local',
      phone: '+55 11 90000-0008',
      documentType: null,
      documentNumber: null,
      notes: 'Synthetic demo guest. Already checked out.',
    },
    {
      id: IDS.guestIsabela,
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      fullName: 'Isabela Reis (demo)',
      email: 'isabela.reis@demo.nova.local',
      phone: '+55 11 90000-0009',
      documentType: GuestDocumentType.PASSPORT,
      documentNumber: 'DEMO-P-0009',
      notes: 'Synthetic demo guest. No real personal data.',
    },
  ];

  for (const guest of guests) {
    await prisma.guest.upsert({
      where: { id: guest.id },
      update: {
        fullName: guest.fullName,
        email: guest.email,
        phone: guest.phone,
        documentType: guest.documentType,
        documentNumber: guest.documentNumber,
        notes: guest.notes,
        status: RecordStatus.ACTIVE,
      },
      create: { ...guest, status: RecordStatus.ACTIVE },
    });
  }

  const demoReservations = [
    {
      id: IDS.reservationInHouse1,
      code: 'DEMO-1101',
      status: ReservationStatus.CHECKED_IN,
      source: 'mostrador',
      checkInDate: demoCalendarDate(-2),
      checkOutDate: demoCalendarDate(1),
      adults: 2,
      children: 0,
      guestId: IDS.guestBruno,
      roomTypeId: IDS.roomTypeCentroStandard,
      roomId: IDS.roomCentro101,
      notes: 'Llegó con equipaje extra. Sintético.',
      stay: { checkedInAt: demoInstant(-2, 15), checkedOutAt: null },
    },
    {
      id: IDS.reservationInHouse2,
      code: 'DEMO-1102',
      status: ReservationStatus.CHECKED_IN,
      source: 'web',
      checkInDate: demoCalendarDate(-1),
      checkOutDate: demoCalendarDate(2),
      adults: 1,
      children: 1,
      guestId: IDS.guestDiego,
      roomTypeId: IDS.roomTypeCentroStandard,
      roomId: IDS.roomCentro102,
      notes: 'Solicitó cuna. Sintético.',
      stay: { checkedInAt: demoInstant(-1, 16), checkedOutAt: null },
    },
    {
      id: IDS.reservationArrivalToday,
      code: 'DEMO-1103',
      status: ReservationStatus.CONFIRMED,
      source: 'teléfono',
      checkInDate: demoCalendarDate(0),
      checkOutDate: demoCalendarDate(3),
      adults: 2,
      children: 0,
      guestId: IDS.guestAna,
      roomTypeId: IDS.roomTypeCentroStandard,
      roomId: IDS.roomCentro103,
      notes: 'Llegada de hoy, lista para check-in. Sintético.',
      stay: null,
    },
    {
      id: IDS.reservationUnassignedToday,
      code: 'DEMO-1104',
      status: ReservationStatus.CONFIRMED,
      source: 'web',
      checkInDate: demoCalendarDate(0),
      checkOutDate: demoCalendarDate(2),
      adults: 2,
      children: 0,
      guestId: IDS.guestElisa,
      roomTypeId: IDS.roomTypeCentroStandard,
      roomId: null,
      notes: 'Llegada de hoy sin habitación: sirve para probar la asignación. Sintético.',
      stay: null,
    },
    {
      id: IDS.reservationDepartureToday,
      code: 'DEMO-1105',
      status: ReservationStatus.CHECKED_IN,
      source: 'mostrador',
      checkInDate: demoCalendarDate(-3),
      checkOutDate: demoCalendarDate(0),
      adults: 1,
      children: 0,
      guestId: IDS.guestFelipe,
      roomTypeId: IDS.roomTypeCentroStandard,
      roomId: IDS.roomCentro104,
      notes: 'Salida de hoy. Sintético.',
      stay: { checkedInAt: demoInstant(-3, 14), checkedOutAt: null },
    },
    {
      id: IDS.reservationFuture1,
      code: 'DEMO-1106',
      status: ReservationStatus.CONFIRMED,
      source: 'web',
      checkInDate: demoCalendarDate(2),
      checkOutDate: demoCalendarDate(4),
      adults: 2,
      children: 0,
      guestId: IDS.guestGabriela,
      roomTypeId: IDS.roomTypeCentroDeluxe,
      roomId: IDS.roomCentro201,
      notes: 'Reserva futura. Sintético.',
      stay: null,
    },
    {
      id: IDS.reservationPastStay,
      code: 'DEMO-1107',
      status: ReservationStatus.CHECKED_OUT,
      source: 'mostrador',
      checkInDate: demoCalendarDate(-6),
      checkOutDate: demoCalendarDate(-4),
      adults: 1,
      children: 0,
      guestId: IDS.guestHenrique,
      roomTypeId: IDS.roomTypeCentroStandard,
      roomId: IDS.roomCentro105,
      notes: 'Estadía cerrada. Sintético.',
      stay: { checkedInAt: demoInstant(-6, 15), checkedOutAt: demoInstant(-4, 11) },
    },
    {
      id: IDS.reservationFuture2,
      code: 'DEMO-1108',
      status: ReservationStatus.CONFIRMED,
      source: 'teléfono',
      checkInDate: demoCalendarDate(5),
      checkOutDate: demoCalendarDate(7),
      adults: 2,
      children: 1,
      guestId: IDS.guestIsabela,
      roomTypeId: IDS.roomTypeCentroStandard,
      roomId: null,
      notes: 'Reserva futura sin habitación. Sintético.',
      stay: null,
    },
  ];

  const historyRows: Array<{
    organizationId: string;
    propertyId: string;
    reservationId: string;
    action: string;
    fromStatus: ReservationStatus | null;
    toStatus: ReservationStatus;
    fromRoomId: string | null;
    toRoomId: string | null;
    reason: string | null;
    actorUserId: string;
    occurredAt: Date;
  }> = [];

  for (const demo of demoReservations) {
    const reservation = await prisma.reservation.upsert({
      where: { propertyId_code: { propertyId: IDS.propertyCentro, code: demo.code } },
      update: {
        status: demo.status,
        source: demo.source,
        checkInDate: demo.checkInDate,
        checkOutDate: demo.checkOutDate,
        adults: demo.adults,
        children: demo.children,
        guestId: demo.guestId,
        roomTypeId: demo.roomTypeId,
        roomId: demo.roomId,
        notes: demo.notes,
        cancelledAt: null,
        cancellationReason: null,
      },
      create: {
        id: demo.id,
        organizationId: IDS.organizationA,
        propertyId: IDS.propertyCentro,
        code: demo.code,
        status: demo.status,
        source: demo.source,
        checkInDate: demo.checkInDate,
        checkOutDate: demo.checkOutDate,
        adults: demo.adults,
        children: demo.children,
        guestId: demo.guestId,
        roomTypeId: demo.roomTypeId,
        roomId: demo.roomId,
        notes: demo.notes,
        createdByUserId: IDS.userAdmin,
      },
    });

    if (demo.stay === null) {
      // Keep the demo dataset reproducible after someone checks a demo
      // reservation in from the UI.
      await prisma.stay.deleteMany({ where: { reservationId: reservation.id } });
    }

    if (demo.stay !== null) {
      await prisma.stay.upsert({
        where: { reservationId: reservation.id },
        update: {
          status: demo.stay.checkedOutAt === null ? StayStatus.IN_HOUSE : StayStatus.CHECKED_OUT,
          roomId: demo.roomId as string,
          guestId: demo.guestId,
          checkedInAt: demo.stay.checkedInAt,
          checkedInByUserId: IDS.userAdmin,
          checkedOutAt: demo.stay.checkedOutAt,
          checkedOutByUserId: demo.stay.checkedOutAt === null ? null : IDS.userAdmin,
          checkOutNotes: demo.stay.checkedOutAt === null ? null : 'Salida de demostración.',
        },
        create: {
          organizationId: IDS.organizationA,
          propertyId: IDS.propertyCentro,
          reservationId: reservation.id,
          guestId: demo.guestId,
          roomId: demo.roomId as string,
          status: demo.stay.checkedOutAt === null ? StayStatus.IN_HOUSE : StayStatus.CHECKED_OUT,
          checkedInAt: demo.stay.checkedInAt,
          checkedInByUserId: IDS.userAdmin,
          checkedOutAt: demo.stay.checkedOutAt,
          checkedOutByUserId: demo.stay.checkedOutAt === null ? null : IDS.userAdmin,
          checkOutNotes: demo.stay.checkedOutAt === null ? null : 'Salida de demostración.',
        },
      });
    }

    historyRows.push({
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      reservationId: reservation.id,
      action: 'reservation.created',
      fromStatus: null,
      toStatus: ReservationStatus.CONFIRMED,
      fromRoomId: null,
      toRoomId: null,
      reason: null,
      actorUserId: IDS.userAdmin,
      occurredAt: demoInstant(-8, 10),
    });

    if (demo.roomId !== null) {
      historyRows.push({
        organizationId: IDS.organizationA,
        propertyId: IDS.propertyCentro,
        reservationId: reservation.id,
        action: 'reservation.room_assigned',
        fromStatus: ReservationStatus.CONFIRMED,
        toStatus: ReservationStatus.CONFIRMED,
        fromRoomId: null,
        toRoomId: demo.roomId,
        reason: null,
        actorUserId: IDS.userAdmin,
        occurredAt: demoInstant(-8, 11),
      });
    }

    if (demo.stay !== null) {
      historyRows.push({
        organizationId: IDS.organizationA,
        propertyId: IDS.propertyCentro,
        reservationId: reservation.id,
        action: 'reservation.checked_in',
        fromStatus: ReservationStatus.CONFIRMED,
        toStatus: ReservationStatus.CHECKED_IN,
        fromRoomId: null,
        toRoomId: demo.roomId,
        reason: null,
        actorUserId: IDS.userAdmin,
        occurredAt: demo.stay.checkedInAt,
      });
    }

    if (demo.stay?.checkedOutAt != null) {
      historyRows.push({
        organizationId: IDS.organizationA,
        propertyId: IDS.propertyCentro,
        reservationId: reservation.id,
        action: 'reservation.checked_out',
        fromStatus: ReservationStatus.CHECKED_IN,
        toStatus: ReservationStatus.CHECKED_OUT,
        fromRoomId: demo.roomId,
        toRoomId: demo.roomId,
        reason: 'Salida de demostración.',
        actorUserId: IDS.userAdmin,
        occurredAt: demo.stay.checkedOutAt,
      });
    }
  }

  // ReservationHistory is append-only (a database trigger rejects UPDATE/DELETE),
  // so seeding checks for an existing event instead of upserting it.
  for (const row of historyRows) {
    const existing = await prisma.reservationHistory.findFirst({
      where: { reservationId: row.reservationId, action: row.action },
      select: { id: true },
    });
    if (existing === null) {
      await prisma.reservationHistory.create({ data: row });
    }
  }

  // Versioned, property-scoped demo templates. `body` is plain text: the
  // renderer escapes it and only fixed sections are supported.
  const documentTemplates = [
    {
      key: 'GUEST_REGISTRATION',
      name: 'Ficha de registro de huésped',
      title: 'Ficha de registro de hóspede',
      body: 'Declaro que os dados informados são verdadeiros e autorizo o tratamento necessário para a hospedagem, conforme a legislação aplicável e as políticas do estabelecimento. Este documento não substitui a identificação oficial quando exigida por lei.',
    },
    {
      key: 'LODGING_TERMS',
      name: 'Términos de hospedaje',
      title: 'Termos e condições de hospedagem',
      body: 'O hóspede compromete-se a respeitar horários, regras de convivência, restrições de acesso e orientações de segurança do estabelecimento. Danos ao patrimônio podem ser cobrados conforme a política vigente. O tratamento de dados pessoais observa a finalidade da hospedagem e os direitos previstos na legislação aplicável.\n\nA assinatura abaixo registra a ciência das condições acima no momento da recepção.',
    },
    {
      key: 'CHECKIN_SUMMARY',
      name: 'Resumen de check-in',
      title: 'Resumo de check-in',
      body: '',
    },
  ] as const;

  const documentTemplateProperties = [
    {
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyCentro,
      createdById: IDS.userAdmin,
    },
    {
      organizationId: IDS.organizationA,
      propertyId: IDS.propertyPraia,
      createdById: IDS.userAdmin,
    },
    {
      organizationId: IDS.organizationB,
      propertyId: IDS.propertyBosque,
      createdById: IDS.userAdminB,
    },
  ];

  for (const property of documentTemplateProperties) {
    for (const template of documentTemplates) {
      await prisma.documentTemplate.upsert({
        where: {
          propertyId_key_locale_version: {
            propertyId: property.propertyId,
            key: template.key,
            locale: 'pt-BR',
            version: 1,
          },
        },
        update: {
          name: template.name,
          title: template.title,
          body: template.body,
          isPublished: true,
          isActive: true,
        },
        create: {
          organizationId: property.organizationId,
          propertyId: property.propertyId,
          key: template.key,
          name: template.name,
          title: template.title,
          body: template.body,
          locale: 'pt-BR',
          version: 1,
          isPublished: true,
          isActive: true,
          createdById: property.createdById,
          publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    }
  }

  const [organizations, properties, usersCount, roles, roomTypesCount, roomsCount, guestsCount] =
    await Promise.all([
      prisma.organization.count(),
      prisma.property.count(),
      prisma.user.count(),
      prisma.role.count(),
      prisma.roomType.count(),
      prisma.room.count(),
      prisma.guest.count(),
    ]);

  console.log(
    `Seed complete: ${organizations} organizations, ${properties} properties, ${usersCount} users, ${roles} roles, ${roomTypesCount} room types, ${roomsCount} rooms, ${guestsCount} guests.`,
  );
  console.log(`Demo password for every synthetic user: ${DEMO_PASSWORD}`);
  console.log('Development users:');
  console.log(`  admin@demo.nova.local       -> ${IDS.userAdmin} (org admin; Centro + Praia)`);
  console.log(`  reception@demo.nova.local   -> ${IDS.userReception} (Centro)`);
  console.log(`  auditor@demo.nova.local     -> ${IDS.userAuditor} (Praia)`);
  console.log(`  housekeeper@demo.nova.local -> ${IDS.userHousekeeper} (Centro)`);
  console.log(`  admin.b@demo.nova.local     -> ${IDS.userAdminB} (Bosque)`);
  console.log(`  disabled@demo.nova.local    -> ${IDS.userDisabled} (DISABLED)`);
}

seed()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
