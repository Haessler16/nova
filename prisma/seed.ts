import {
  PrismaClient,
  RecordStatus,
  HousekeepingState,
  RoomOperationalState,
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

  roomTypeCentroStandard: '00000000-0000-4000-8000-000000000041',
  roomTypeCentroDeluxe: '00000000-0000-4000-8000-000000000042',
  roomTypePraiaStandard: '00000000-0000-4000-8000-000000000043',

  roomCentro101: '00000000-0000-4000-8000-000000000051',
  roomCentro102: '00000000-0000-4000-8000-000000000052',
  roomCentro103: '00000000-0000-4000-8000-000000000053',
  roomCentro201: '00000000-0000-4000-8000-000000000054',
  roomPraia101: '00000000-0000-4000-8000-000000000055',
  roomPraia102: '00000000-0000-4000-8000-000000000056',
} as const;

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
    ],
  },
  {
    id: IDS.roleAuditorA,
    organizationId: IDS.organizationA,
    key: 'AUDITOR',
    name: 'Auditor / finance',
    system: true,
    permissions: [IDS.permissionPropertyRead, IDS.permissionAuditRead, IDS.permissionInventoryRead],
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

  const [organizations, properties, usersCount, roles, roomTypesCount, roomsCount] =
    await Promise.all([
      prisma.organization.count(),
      prisma.property.count(),
      prisma.user.count(),
      prisma.role.count(),
      prisma.roomType.count(),
      prisma.room.count(),
    ]);

  console.log(
    `Seed complete: ${organizations} organizations, ${properties} properties, ${usersCount} users, ${roles} roles, ${roomTypesCount} room types, ${roomsCount} rooms.`,
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
