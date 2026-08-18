#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
PROJECT_DIR=${SCRIPT_DIR:h}
CONFIG_FILE=${BNTRIP_BACKUP_CONFIG:-"$PROJECT_DIR/.env.backup"}

if [[ -f "$CONFIG_FILE" ]]; then
  set -a
  source "$CONFIG_FILE"
  set +a
fi

if [[ -z "${BNTRIP_BACKUP_DIR:-}" ]]; then
  print -u2 "BNTRIP_BACKUP_DIR is required. Copy .env.backup.example to .env.backup and set an external-disk path."
  exit 1
fi

BACKUP_ROOT=${BNTRIP_BACKUP_DIR:A}
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
FINAL_DIR="$BACKUP_ROOT/$STAMP"
WORK_DIR="$BACKUP_ROOT/.partial-$STAMP-$$"
LOCK_DIR="$BACKUP_ROOT/.backup.lock"

mkdir -p "$BACKUP_ROOT"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  print -u2 "Another BN Trip backup is already running: $LOCK_DIR"
  exit 1
fi

cleanup() {
  rm -rf "$WORK_DIR"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"
if ! docker compose ps --status running db --format '{{.Service}}' | grep -qx db; then
  print -u2 "The PostgreSQL service is not running. Start it with: docker compose up -d db"
  exit 1
fi

mkdir "$WORK_DIR"
print "Backing up PostgreSQL..."
docker compose exec -T db pg_dump \
  --username bntrip \
  --dbname bntrip \
  --format=custom \
  --no-owner \
  --no-privileges > "$WORK_DIR/database.dump"

print "Backing up uploaded images and documents..."
docker compose run --rm --no-deps -T --entrypoint sh app \
  -c 'tar -C /app/uploads -czf - .' > "$WORK_DIR/uploads.tar.gz"

print "Verifying backup files..."
docker compose exec -T db pg_restore --list < "$WORK_DIR/database.dump" >/dev/null
tar -tzf "$WORK_DIR/uploads.tar.gz" >/dev/null
(
  cd "$WORK_DIR"
  shasum -a 256 database.dump uploads.tar.gz > SHA256SUMS
)

GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || print unknown)
cat > "$WORK_DIR/manifest.txt" <<EOF
format=bn-trip-backup-v1
created_at_utc=$STAMP
git_commit=$GIT_COMMIT
database=PostgreSQL custom-format dump
uploads=gzip-compressed tar archive
EOF

mv "$WORK_DIR" "$FINAL_DIR"

if [[ -n "${BNTRIP_RCLONE_REMOTE:-}" ]]; then
  if ! command -v rclone >/dev/null 2>&1; then
    print -u2 "Local backup succeeded, but rclone is not installed; cloud upload was skipped."
    print -u2 "Snapshot: $FINAL_DIR"
    exit 2
  fi

  print "Uploading encrypted snapshot to ${BNTRIP_RCLONE_REMOTE%/}/$STAMP ..."
  rclone copy "$FINAL_DIR" "${BNTRIP_RCLONE_REMOTE%/}/$STAMP" \
    --checksum \
    --immutable
fi

print "Backup complete: $FINAL_DIR"
