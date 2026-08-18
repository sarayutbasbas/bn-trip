#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
PROJECT_DIR=${SCRIPT_DIR:h}
SNAPSHOT_DIR=${1:-}

if [[ -z "$SNAPSHOT_DIR" || ! -d "$SNAPSHOT_DIR" ]]; then
  print -u2 "Usage: RESTORE_CONFIRM=restore-bn-trip $0 /path/to/snapshot"
  exit 1
fi

SNAPSHOT_DIR=${SNAPSHOT_DIR:A}
for required in database.dump uploads.tar.gz SHA256SUMS manifest.txt; do
  if [[ ! -f "$SNAPSHOT_DIR/$required" ]]; then
    print -u2 "Invalid snapshot: missing $required"
    exit 1
  fi
done

if [[ "${RESTORE_CONFIRM:-}" != "restore-bn-trip" ]]; then
  print -u2 "Restore replaces the current BN Trip database and uploaded files."
  print -u2 "Re-run with RESTORE_CONFIRM=restore-bn-trip after checking the snapshot path."
  exit 1
fi

print "Verifying snapshot checksums..."
(cd "$SNAPSHOT_DIR" && shasum -a 256 -c SHA256SUMS)
tar -tzf "$SNAPSHOT_DIR/uploads.tar.gz" >/dev/null

cd "$PROJECT_DIR"
docker compose up -d db

restart_app() {
  docker compose up -d app >/dev/null 2>&1 || true
}
trap restart_app EXIT INT TERM

print "Stopping the app while data is restored..."
docker compose stop app >/dev/null 2>&1 || true

print "Restoring PostgreSQL..."
docker compose exec -T db pg_restore \
  --username bntrip \
  --dbname bntrip \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error < "$SNAPSHOT_DIR/database.dump"

print "Restoring uploaded images and documents..."
docker compose run --rm --no-deps -T --entrypoint sh app \
  -c 'find /app/uploads -mindepth 1 -delete && tar -C /app/uploads -xzf -' \
  < "$SNAPSHOT_DIR/uploads.tar.gz"

docker compose up -d app
trap - EXIT INT TERM
print "Restore complete. Check the app and /api/health before accepting new changes."
