#!/usr/bin/env bash
set -euo pipefail

# NOVA PMS logical backup (local/dev or explicitly targeted environments only).
# Uses pg_dump via Docker by default. Never point this at an unapproved target.

CONTAINER="${POSTGRES_CONTAINER:-nova-postgres}"
DB_USER="${POSTGRES_USER:-nova}"
DB_NAME="${POSTGRES_DB:-nova_pms}"
OUT_DIR="${BACKUP_DIR:-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/nova-pms-${DB_NAME}-${STAMP}.dump"

if [[ "${ALLOW_REMOTE_BACKUP:-0}" != "1" ]]; then
  case "${DATABASE_URL:-}" in
    *localhost*|*127.0.0.1*|*nova-postgres*|"")
      ;;
    *)
      echo "Refusing backup: DATABASE_URL does not look local. Set ALLOW_REMOTE_BACKUP=1 only with explicit approval." >&2
      exit 2
      ;;
  esac
fi

echo "Creating backup: $FILE"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner --no-privileges > "$FILE"
echo "Backup complete: $(wc -c < "$FILE") bytes"
