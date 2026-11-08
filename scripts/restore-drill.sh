#!/usr/bin/env bash
set -euo pipefail

# NOVA PMS restore drill. Creates a temporary database, restores a backup,
# runs basic integrity checks, then drops the temporary database.
# DESTRUCTIVE if misused: never run against production. Requires CONFIRM_RESTORE_DRILL=1.

if [[ "${CONFIRM_RESTORE_DRILL:-0}" != "1" ]]; then
  echo "Set CONFIRM_RESTORE_DRILL=1 to run a restore drill (creates/drops a temp database)." >&2
  exit 2
fi

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: CONFIRM_RESTORE_DRILL=1 $0 <backup.dump>" >&2
  exit 2
fi

CONTAINER="${POSTGRES_CONTAINER:-nova-postgres}"
DB_USER="${POSTGRES_USER:-nova}"
DRILL_DB="nova_pms_restore_drill_$(date -u +%s)"

case "${DATABASE_URL:-}" in
  *localhost*|*127.0.0.1*|*nova-postgres*|"") ;;
  *)
    echo "Refusing restore drill: DATABASE_URL does not look local." >&2
    exit 2
    ;;
esac

cleanup() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DRILL_DB\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating drill database: $DRILL_DB"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DRILL_DB\";"

echo "Restoring $BACKUP_FILE"
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$DRILL_DB" --no-owner --no-privileges --exit-on-error < "$BACKUP_FILE"

echo "Running integrity checks"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DRILL_DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users' AS table_name, count(*) FROM "User";
SELECT 'organizations' AS table_name, count(*) FROM "Organization";
SELECT 'audit_events' AS table_name, count(*) FROM "AuditEvent";
SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname='AuditEvent_append_only_row';
SQL

echo "Restore drill completed successfully; temporary database will be dropped."
