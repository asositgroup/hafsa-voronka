#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

env_file=deploy/.env.prod
[[ -f "$env_file" ]] || { echo "Missing $env_file (copy deploy/.env.prod.example)" >&2; exit 1; }

compose=(docker compose --env-file "$env_file" -f deploy/docker-compose.prod.yml)
domain=$(grep -m1 '^API_DOMAIN=' "$env_file" | cut -d= -f2- || true)
host_port=$(grep -m1 '^HOST_PORT=' "$env_file" | cut -d= -f2- || true)
host_port=${host_port:-3101}

git pull --ff-only || true
"${compose[@]}" up -d --build --remove-orphans

echo "Waiting for API to become healthy on port $host_port..."
for _ in $(seq 1 45); do
  if curl -fsS -m 5 "http://127.0.0.1:$host_port/health" >/dev/null 2>&1; then
    docker image prune -f >/dev/null 2>&1 || true
    echo "Local API is healthy: http://127.0.0.1:$host_port/health"
    if [[ -n "$domain" ]] && curl -fsS -m 5 "https://$domain/health" >/dev/null 2>&1; then
      echo "Public endpoint is healthy: https://$domain/health"
    else
      echo "Notice: Public endpoint https://$domain/health not yet responding (check Nginx/SSL & DNS if this is first setup)."
    fi
    echo "Deployed commit $(git rev-parse --short HEAD 2>/dev/null || echo 'current')"
    exit 0
  fi
  sleep 2
done

echo "API did not become healthy on http://127.0.0.1:$host_port/health. Recent logs:" >&2
"${compose[@]}" logs --tail 60 api >&2
exit 1
