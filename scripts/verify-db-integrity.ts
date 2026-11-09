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
  'Folio_openedByUserId_fkey',
  'Folio_property_tenant_fkey',
  'Folio_tenant_stay_fkey',
  'Folio_tenant_reservation_fkey',
  'Folio_number_check',
  'Folio_currency_code_check',
  'Folio_link_check',
  'Folio_idempotency_key_check',
  'FolioLine_organizationId_fkey',
  'FolioLine_propertyId_fkey',
  'FolioLine_folioId_fkey',
  'FolioLine_createdByUserId_fkey',
  'FolioLine_property_tenant_fkey',
  'FolioLine_tenant_folio_fkey',
  'FolioLine_description_check',
  'FolioLine_amount_check',
  'FolioLine_currency_code_check',
  'FolioLine_void_check',
  'FolioLine_idempotency_key_check',
  'Payment_organizationId_fkey',
  'Payment_propertyId_fkey',
  'Payment_folioId_fkey',
  'Payment_receivedByUserId_fkey',
  'Payment_property_tenant_fkey',
  'Payment_tenant_folio_fkey',
  'Payment_amount_check',
  'Payment_currency_code_check',
  'Payment_method_check',
  'Payment_idempotency_key_check',
  'CashSession_organizationId_fkey',
  'CashSession_propertyId_fkey',
  'CashSession_openingByUserId_fkey',
  'CashSession_closedByUserId_fkey',
  'CashSession_property_tenant_fkey',
  'CashSession_name_check',
  'CashSession_amount_check',
  'CashSession_close_check',
  'CashSession_currency_code_check',
  'CashSession_idempotency_key_check',
  'CashMovement_organizationId_fkey',
  'CashMovement_propertyId_fkey',
  'CashMovement_cashSessionId_fkey',
  'CashMovement_recordedByUserId_fkey',
  'CashMovement_property_tenant_fkey',
  'CashMovement_tenant_cash_session_fkey',
  'CashMovement_amount_check',
  'CashMovement_currency_code_check',
  'CashMovement_idempotency_key_check',
  'OperationalClose_organizationId_fkey',
  'OperationalClose_propertyId_fkey',
  'OperationalClose_closedByUserId_fkey',
  'OperationalClose_reopenedByUserId_fkey',
  'OperationalClose_property_tenant_fkey',
  'OperationalClose_snapshot_check',
  'OperationalClose_reopen_check',
  'OperationalClose_idempotency_key_check',
  // The draft migration dropped Phase 4 composite constraints too.
  'Stay_tenant_reservation_fkey',
  'Stay_tenant_room_fkey',
  'Stay_tenant_guest_fkey',
  'Incident_tenant_room_fkey',
  'Incident_tenant_reservation_fkey',
  'Incident_tenant_stay_fkey',
  // Phase 6 pilot feedback hardening.
  'PilotFeedback_organizationId_fkey',
  'PilotFeedback_propertyId_fkey',
  'PilotFeedback_userId_fkey',
  'PilotFeedback_reviewedByUserId_fkey',
  'PilotFeedback_property_tenant_fkey',
  'PilotFeedback_author_membership_fkey',
  'PilotFeedback_reviewer_membership_fkey',
  'PilotFeedback_message_check',
  'PilotFeedback_rating_check',
  'PilotFeedback_context_check',
  'PilotFeedback_review_check',
  // Phase 7 guest CSV imports.
  'GuestImport_organizationId_fkey',
  'GuestImport_propertyId_fkey',
  'GuestImport_createdByUserId_fkey',
  'GuestImport_property_tenant_fkey',
  'GuestImport_creator_membership_fkey',
  'GuestImport_row_count_check',
  'GuestImport_created_count_check',
  'GuestImport_idempotency_key_check',
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
  // Full and partial unique constraints for Phase 5.
  'Folio_propertyId_number_key',
  'Folio_propertyId_idempotencyKey_key',
  'Folio_one_active_per_reservation_key',
  'Folio_one_active_per_stay_key',
  'FolioLine_propertyId_idempotencyKey_key',
  'Payment_propertyId_idempotencyKey_key',
  'CashSession_propertyId_idempotencyKey_key',
  'CashSession_one_open_per_property_key',
  'PilotFeedback_organizationId_propertyId_id_key',
  'GuestImport_propertyId_idempotencyKey_key',
  'GuestImport_organizationId_propertyId_id_key',
  'CashMovement_propertyId_idempotencyKey_key',
  'OperationalClose_organizationId_propertyId_operationalDate_key',
  'OperationalClose_propertyId_idempotencyKey_key',
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
