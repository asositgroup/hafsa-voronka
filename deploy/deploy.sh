#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

env_file=deploy/.env.prod
[[ -f "$env_file" ]] || { echo "Missing $env_file (copy deploy/.env.prod.example)" >&2; exit 1; }

compose=(docker compose --env-file "$env_file" -f deploy/docker-compose.prod.yml)
domain=$(grep -m1 '^API_DOMAIN=' "$env_file" | cut -d= -f2-)

git pull --ff-only
"${compose[@]}" up -d --build --remove-orphans

for _ in $(seq 1 45); do
  if curl -fsS -m 5 "https://$domain/health" >/dev/null 2>&1; then
    docker image prune -f >/dev/null
    echo "Deployed $(git rev-parse --short HEAD): https://$domain is healthy"
    exit 0
  fi
  sleep 2
done

echo "API did not become healthy. Recent logs:" >&2
"${compose[@]}" logs --tail 60 api >&2
exit 1
