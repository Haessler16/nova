import { PrismaClient } from '@prisma/client';

/**
 * Verifies database objects that Prisma does not model: composite tenant
 * foreign keys, CHECK constraints, the room-block exclusion constraint and
 * append-only triggers.
 *
 * Run after `prisma migrate deploy` in local development and CI. A missing
 * object means a migration was edited, replaced or bypassed and the database
 * can no longer be trusted to enforce tenant/audit invariants.
 */
const prisma = new PrismaClient();

const EXPECTED_CONSTRAINTS = [
  // Phase 1 tenant and audit hardening.
  'PropertyMembership_property_tenant_fkey',
  'PropertyMembership_role_tenant_fkey',
  'PropertyMembership_membership_fkey',
  'AuditEvent_property_tenant_fkey',
  'User_email_normalized_check',
  'Property_currency_code_check',
  'Property_operational_day_start_check',
  'Property_timezone_not_blank_check',
  'AuditEvent_metadata_size_check',
  // Phase 2 organization roles and inventory hardening.
  'Membership_role_tenant_fkey',
  'Session_token_hash_check',
  'Session_expiry_check',
  'RoomType_property_tenant_fkey',
  'Room_property_tenant_fkey',
  'Room_room_type_tenant_fkey',
  'RoomBlock_property_tenant_fkey',
  'RoomBlock_room_tenant_fkey',
  'RoomBlock_creator_membership_fkey',
  'RoomStatusHistory_property_tenant_fkey',
  'RoomStatusHistory_room_tenant_fkey',
  'RoomStatusHistory_block_tenant_fkey',
  'RoomStatusHistory_actor_membership_fkey',
  'RoomType_code_check',
  'RoomType_name_check',
  'RoomType_capacity_check',
  'Room_number_check',
  'Room_attributes_count_check',
  'Room_floor_check',
  'Room_building_check',
  'RoomBlock_reason_check',
  'RoomBlock_interval_check',
  'RoomBlock_release_reason_check',
  'RoomBlock_status_fields_check',
  'RoomBlock_active_no_overlap',
  'RoomStatusHistory_to_state_check',
  'RoomStatusHistory_from_state_check',
  'RoomStatusHistory_reason_check',
  // Phase 3 auth, administration and security hardening.
  'PasswordResetToken_hash_check',
  'PasswordResetToken_expiry_check',
  'EmailVerificationToken_hash_check',
  'EmailVerificationToken_expiry_check',
  'User_lockout_fields_check',
  'User_mfa_fields_check',
  'Session_ip_hash_check',
  'Session_user_agent_check',
  'Role_key_check',
  'Role_name_check',
  'SecurityEvent_type_check',
  'SecurityEvent_severity_check',
  'SecurityEvent_metadata_size_check',
  // Phase 3 guests and reservations hardening.
  'Guest_property_tenant_fkey',
  'Guest_full_name_check',
  'Guest_email_check',
  'Guest_phone_check',
  'Guest_document_check',
  'Guest_document_number_check',
  'Guest_notes_check',
  'Reservation_property_tenant_fkey',
  'Reservation_guest_tenant_fkey',
  'Reservation_room_type_tenant_fkey',
  'Reservation_room_tenant_fkey',
  'Reservation_creator_membership_fkey',
  'Reservation_code_check',
  'Reservation_date_order_check',
  'Reservation_occupancy_check',
  'Reservation_source_check',
  'Reservation_notes_check',
  'Reservation_idempotency_key_check',
  'Reservation_cancellation_fields_check',
  'Reservation_cancellation_reason_check',
  'Reservation_room_date_no_overlap',
  'ReservationHistory_property_tenant_fkey',
  'ReservationHistory_reservation_tenant_fkey',
  'ReservationHistory_actor_membership_fkey',
  'ReservationHistory_action_check',
  'ReservationHistory_reason_check',
  'ReservationHistory_room_change_check',
  // Phase 5 folio, cash and payments hardening.
  'Folio_organizationId_fkey',
  'Folio_propertyId_fkey',
  'Folio_stayId_fkey',
  'Folio_reservationId_fkey',
  'Payment_organizationId_fkey',
  'Payment_propertyId_fkey',
  'Payment_folioId_fkey',
  'Payment_stayId_fkey',
  'Payment_reservationId_fkey',
  'CashSession_organizationId_fkey',
  'CashSession_propertyId_fkey',
  'CashMovement_organizationId_fkey',
  'CashMovement_propertyId_fkey',
  'CashMovement_cashSessionId_fkey',
] as const;

const EXPECTED_TRIGGERS = [
  'AuditEvent_append_only_row',
  'AuditEvent_append_only_truncate',
  'RoomStatusHistory_append_only_row',
  'RoomStatusHistory_append_only_truncate',
  'SecurityEvent_append_only_row',
  'SecurityEvent_append_only_truncate',
  'ReservationHistory_append_only_row',
  'ReservationHistory_append_only_truncate',
] as const;

const EXPECTED_FUNCTIONS = [
  'nova_audit_event_append_only',
  'nova_room_status_history_append_only',
  'nova_security_event_append_only',
  'nova_reservation_history_append_only',
] as const;

const EXPECTED_INDEXES = [
  'PasswordResetToken_active_user_key',
  'EmailVerificationToken_active_user_key',
] as const;

async function main(): Promise<void> {
  const [constraints, triggers, functions, extensions, indexes] = await Promise.all([
    prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
    `,
    prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
    `,
    prisma.$queryRaw<Array<{ proname: string }>>`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
    `,
    prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension
    `,
    prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
    `,
  ]);

  const constraintNames = new Set(constraints.map((row) => row.conname));
  const triggerNames = new Set(triggers.map((row) => row.tgname));
  const functionNames = new Set(functions.map((row) => row.proname));
  const extensionNames = new Set(extensions.map((row) => row.extname));
  const indexNames = new Set(indexes.map((row) => row.indexname));

  const missingConstraints = EXPECTED_CONSTRAINTS.filter((name) => !constraintNames.has(name));
  const missingTriggers = EXPECTED_TRIGGERS.filter((name) => !triggerNames.has(name));
  const missingFunctions = EXPECTED_FUNCTIONS.filter((name) => !functionNames.has(name));
  const missingExtensions = ['btree_gist'].filter((name) => !extensionNames.has(name));
  const missingIndexes = EXPECTED_INDEXES.filter((name) => !indexNames.has(name));

  const failures = [
    ...missingConstraints.map((name) => `missing constraint: ${name}`),
    ...missingTriggers.map((name) => `missing trigger: ${name}`),
    ...missingFunctions.map((name) => `missing function: ${name}`),
    ...missingExtensions.map((name) => `missing extension: ${name}`),
    ...missingIndexes.map((name) => `missing index: ${name}`),
  ];

  if (failures.length > 0) {
    console.error('Database integrity verification FAILED:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Database integrity verified: ${EXPECTED_CONSTRAINTS.length} constraints, ` +
      `${EXPECTED_TRIGGERS.length} triggers, ${EXPECTED_FUNCTIONS.length} functions, ` +
      `${EXPECTED_INDEXES.length} indexes and btree_gist.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Database integrity verification could not run:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });