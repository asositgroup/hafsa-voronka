#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <remote:bucket/path>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

remote="$1"
env_file=deploy/.env.prod
compose=(docker compose --env-file "$env_file" -f deploy/docker-compose.prod.yml)
user=$(grep -m1 '^POSTGRES_USER=' "$env_file" | cut -d= -f2-)
db=$(grep -m1 '^POSTGRES_DB=' "$env_file" | cut -d= -f2-)
stamp=$(date -u +%Y%m%d-%H%M%S)
dump=$(mktemp --suffix=.dump)
trap 'rm -f "$dump"' EXIT

command -v rclone >/dev/null || { echo "rclone is not installed" >&2; exit 1; }

"${compose[@]}" exec -T postgres pg_dump -U "$user" -d "$db" -Fc > "$dump"
rclone copyto "$dump" "$remote/hafsa-$stamp.dump"
rclone delete --min-age 30d "$remote"
echo "Backup uploaded: $remote/hafsa-$stamp.dump ($(du -h "$dump" | cut -f1))"
