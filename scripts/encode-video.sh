#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <input> <out_dir> [mp4|hls]" >&2
  exit 1
fi

input="$1"
out_dir="$2"
mode="${3:-mp4}"

if [ ! -f "$input" ]; then
  echo "Error: input file '$input' not found" >&2
  exit 1
fi

if [ "$mode" != "mp4" ] && [ "$mode" != "hls" ]; then
  echo "Error: invalid mode '$mode'. Must be 'mp4' or 'hls'." >&2
  exit 1
fi

command -v ffmpeg >/dev/null 2>&1 || {
  echo "Error: ffmpeg is required but not installed." >&2
  exit 1
}

command -v ffprobe >/dev/null 2>&1 || {
  echo "Error: ffprobe is required but not installed." >&2
  exit 1
}

mkdir -p "$out_dir"

raw_duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input")
duration_sec=$(awk -v d="$raw_duration" 'BEGIN { printf "%.0f\n", d }')
if [ "$duration_sec" -lt 1 ]; then
  duration_sec=1
fi

poster_time=3
if [ "$duration_sec" -lt 3 ]; then
  poster_time=0
fi

ffmpeg -y -ss "$poster_time" -i "$input" -vframes 1 -c:v libwebp "$out_dir/poster.webp"

has_audio=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "$input")

if [ "$mode" = "mp4" ]; then
  if [ -n "$has_audio" ]; then
    ffmpeg -y -i "$input" \
      -vf "scale=-2:720" \
      -c:v libx264 \
      -b:v 2000k \
      -maxrate 2500k \
      -bufsize 4000k \
      -pix_fmt yuv420p \
      -c:a aac \
      -b:a 128k \
      -ar 44100 \
      -movflags +faststart \
      "$out_dir/master.mp4"
  else
    ffmpeg -y -i "$input" \
      -vf "scale=-2:720" \
      -c:v libx264 \
      -b:v 2000k \
      -maxrate 2500k \
      -bufsize 4000k \
      -pix_fmt yuv420p \
      -movflags +faststart \
      "$out_dir/master.mp4"
  fi
elif [ "$mode" = "hls" ]; then
  if [ -n "$has_audio" ]; then
    ffmpeg -y -i "$input" \
      -filter_complex "[0:v]split=3[v1][v2][v3];[v1]scale=w=-2:h=360[v1out];[v2]scale=w=-2:h=540[v2out];[v3]scale=w=-2:h=720[v3out]" \
      -map "[v1out]" -c:v:0 libx264 -b:v:0 800k -maxrate:v:0 856k -bufsize:v:0 1200k -pix_fmt:v:0 yuv420p \
      -map "[v2out]" -c:v:1 libx264 -b:v:1 1400k -maxrate:v:1 1498k -bufsize:v:1 2100k -pix_fmt:v:1 yuv420p \
      -map "[v3out]" -c:v:2 libx264 -b:v:2 2000k -maxrate:v:2 2140k -bufsize:v:2 3000k -pix_fmt:v:2 yuv420p \
      -map 0:a -c:a:0 aac -b:a:0 96k -ar:a:0 44100 \
      -map 0:a -c:a:1 aac -b:a:1 128k -ar:a:1 44100 \
      -map 0:a -c:a:2 aac -b:a:2 128k -ar:a:2 44100 \
      -force_key_frames "expr:gte(t,n_forced*6)" \
      -sc_threshold 0 \
      -f hls \
      -hls_time 6 \
      -hls_playlist_type vod \
      -hls_segment_type mpegts \
      -master_pl_name master.m3u8 \
      -hls_segment_filename "$out_dir/%v_%03d.ts" \
      -var_stream_map "v:0,a:0,name:360p v:1,a:1,name:540p v:2,a:2,name:720p" \
      "$out_dir/%v.m3u8"
  else
    ffmpeg -y -i "$input" \
      -filter_complex "[0:v]split=3[v1][v2][v3];[v1]scale=w=-2:h=360[v1out];[v2]scale=w=-2:h=540[v2out];[v3]scale=w=-2:h=720[v3out]" \
      -map "[v1out]" -c:v:0 libx264 -b:v:0 800k -maxrate:v:0 856k -bufsize:v:0 1200k -pix_fmt:v:0 yuv420p \
      -map "[v2out]" -c:v:1 libx264 -b:v:1 1400k -maxrate:v:1 1498k -bufsize:v:1 2100k -pix_fmt:v:1 yuv420p \
      -map "[v3out]" -c:v:2 libx264 -b:v:2 2000k -maxrate:v:2 2140k -bufsize:v:2 3000k -pix_fmt:v:2 yuv420p \
      -force_key_frames "expr:gte(t,n_forced*6)" \
      -sc_threshold 0 \
      -f hls \
      -hls_time 6 \
      -hls_playlist_type vod \
      -hls_segment_type mpegts \
      -master_pl_name master.m3u8 \
      -hls_segment_filename "$out_dir/%v_%03d.ts" \
      -var_stream_map "v:0,name:360p v:1,name:540p v:2,name:720p" \
      "$out_dir/%v.m3u8"
  fi
fi

echo "VIDEO_DURATION_SEC=$duration_sec"
echo "rclone copy \"$out_dir\" r2:funnel-video/lesson-1"
