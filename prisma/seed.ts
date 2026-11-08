import { PrismaClient, RecordStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Deterministic, synthetic development data. No real guest, employee or
 * document data is used. Safe to run repeatedly (`upsert` based).
 */
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

  roleAdminA: '00000000-0000-4000-8000-000000000021',
  roleManagerA: '00000000-0000-4000-8000-000000000022',
  roleReceptionA: '00000000-0000-4000-8000-000000000023',
  roleAuditorA: '00000000-0000-4000-8000-000000000024',
  roleAdminB: '00000000-0000-4000-8000-000000000025',

  permissionPropertyRead: '00000000-0000-4000-8000-000000000031',
  permissionPropertyManage: '00000000-0000-4000-8000-000000000032',
  permissionAuditRead: '00000000-0000-4000-8000-000000000033',
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
    description: 'Create and manage properties within an organization',
  },
  {
    id: IDS.permissionAuditRead,
    key: 'audit.read',
    description: 'Read append-only audit events for a property',
  },
] as const;

const ROLES = [
  {
    id: IDS.roleAdminA,
    organizationId: IDS.organizationA,
    key: 'ORG_ADMIN',
    name: 'Organization administrator',
    permissions: PERMISSIONS.map((permission) => permission.id),
  },
  {
    id: IDS.roleManagerA,
    organizationId: IDS.organizationA,
    key: 'PROPERTY_MANAGER',
    name: 'Property manager',
    permissions: [
      IDS.permissionPropertyRead,
      IDS.permissionPropertyManage,
      IDS.permissionAuditRead,
    ],
  },
  {
    id: IDS.roleReceptionA,
    organizationId: IDS.organizationA,
    key: 'RECEPTIONIST',
    name: 'Receptionist',
    permissions: [IDS.permissionPropertyRead],
  },
  {
    id: IDS.roleAuditorA,
    organizationId: IDS.organizationA,
    key: 'AUDITOR',
    name: 'Auditor / finance',
    permissions: [IDS.permissionPropertyRead, IDS.permissionAuditRead],
  },
  {
    id: IDS.roleAdminB,
    organizationId: IDS.organizationB,
    key: 'ORG_ADMIN',
    name: 'Organization administrator',
    permissions: PERMISSIONS.map((permission) => permission.id),
  },
] as const;

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
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        status: user.status,
        passwordHash: null,
      },
      create: user,
    });
  }

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { organizationId_key: { organizationId: role.organizationId, key: role.key } },
      update: { name: role.name },
      create: {
        id: role.id,
        organizationId: role.organizationId,
        key: role.key,
        name: role.name,
      },
    });

    await prisma.rolePermission.createMany({
      data: role.permissions.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  const memberships = [
    { organizationId: IDS.organizationA, userId: IDS.userAdmin, status: RecordStatus.ACTIVE },
    { organizationId: IDS.organizationA, userId: IDS.userReception, status: RecordStatus.ACTIVE },
    { organizationId: IDS.organizationA, userId: IDS.userAuditor, status: RecordStatus.ACTIVE },
    { organizationId: IDS.organizationA, userId: IDS.userDisabled, status: RecordStatus.SUSPENDED },
    { organizationId: IDS.organizationB, userId: IDS.userAdminB, status: RecordStatus.ACTIVE },
  ];

  for (const membership of memberships) {
    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: membership.organizationId,
          userId: membership.userId,
        },
      },
      update: { status: membership.status },
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

  const [organizations, properties, usersCount, roles] = await Promise.all([
    prisma.organization.count(),
    prisma.property.count(),
    prisma.user.count(),
    prisma.role.count(),
  ]);

  console.log(
    `Seed complete: ${organizations} organizations, ${properties} properties, ${usersCount} users, ${roles} roles.`,
  );
  console.log('Development users:');
  console.log(`  admin@demo.nova.local     -> ${IDS.userAdmin}`);
  console.log(`  reception@demo.nova.local -> ${IDS.userReception}`);
  console.log(`  auditor@demo.nova.local   -> ${IDS.userAuditor}`);
  console.log(`  admin.b@demo.nova.local   -> ${IDS.userAdminB}`);
  console.log(`  disabled@demo.nova.local  -> ${IDS.userDisabled} (DISABLED)`);
}

seed()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
