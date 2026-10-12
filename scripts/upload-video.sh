#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <local_dir> <remote:bucket/path>" >&2
  exit 1
fi

local_dir="$1"
remote_path="$2"
cache_control="Cache-Control: public, max-age=31536000, immutable"

command -v rclone >/dev/null || { echo "rclone is not installed" >&2; exit 1; }
[[ -d "$local_dir" ]] || { echo "Not a directory: $local_dir" >&2; exit 1; }

upload() {
  local pattern="$1" content_type="$2"
  rclone copy "$local_dir" "$remote_path" --include "$pattern" --transfers 16 --s3-no-check-bucket \
    --header-upload "Content-Type: $content_type" --header-upload "$cache_control" --progress
}

upload "*.m3u8" "application/vnd.apple.mpegurl"
upload "*.ts" "video/mp2t"
upload "*.mp4" "video/mp4"
upload "*.webp" "image/webp"

rclone size "$remote_path"
