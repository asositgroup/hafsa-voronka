#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <video_url>" >&2
  exit 1
fi

status=$(curl -sI -o /dev/null -w "%{http_code}" -H "Range: bytes=1000-2000" "$1")
ranges=$(curl -sI "$1" | tr -d '\r' | awk -F': ' 'tolower($1)=="accept-ranges"{print tolower($2)}')

echo "status=$status accept-ranges=${ranges:-none}"

if [[ "$status" != "206" || "$ranges" != "bytes" ]]; then
  echo "Range check failed: expected 206 and Accept-Ranges: bytes" >&2
  exit 1
fi
