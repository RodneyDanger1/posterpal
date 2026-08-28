#!/usr/bin/env bash
# PosterPal backup: pg_dump the app database to a timestamped, compressed file.
#
# Usage:
#   scripts/backup.sh [backup-dir]     # default: ./backups
#   scripts/backup.sh --restore <file> # restore a dump into DATABASE_URL
#
# Env:
#   DATABASE_URL   target database (defaults to local docker-compose values)
#   PGPASSWORD     postgres password (defaults to POSTGRES_PASSWORD or "posterpal")
#
# Retention: keep the newest 14 backups (override with BACKUP_KEEP).
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
KEEP="${BACKUP_KEEP:-14}"

# ── restore mode ─────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--restore" ]]; then
  DUMP_FILE="${2:?usage: scripts/backup.sh --restore <dump.sql.gz>}"
  DB_URL="${DATABASE_URL:-postgres://posterpal:${POSTGRES_PASSWORD:-posterpal}@127.0.0.1:5432/posterpal}"
  echo "[backup] restoring ${DUMP_FILE} into $(echo "$DB_URL" | sed 's|:[^:@/]*@|:***@|')"
  gunzip -c "${DUMP_FILE}" | psql "${DB_URL}"
  echo "[backup] restore complete."
  exit 0
fi

# ── dump mode ───────────────────────────────────────────────────────────────
DB_URL="${DATABASE_URL:-postgres://posterpal:${POSTGRES_PASSWORD:-posterpal}@127.0.0.1:5432/posterpal}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/posterpal_${STAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
echo "[backup] dumping $(echo "$DB_URL" | sed 's|:[^:@/]*@|:***@|') -> ${OUT}"
pg_dump "${DB_URL}" --no-owner --no-privileges | gzip > "${OUT}"

# Retention: keep the newest $KEEP dumps.
ls -1t "${BACKUP_DIR}"/posterpal_*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  echo "[backup] pruning ${old}"
  rm -f "${old}"
done

echo "[backup] done — $(du -h "${OUT}" | cut -f1)"
