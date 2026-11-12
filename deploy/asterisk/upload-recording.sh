#!/bin/sh
# Run by Asterisk (MixMonitor) when a call recording is closed: posts the WAV to the API
# (calls panel, POST /call-logs/<session>/recording) and deletes it. Never blocks a call.
# Usage: upload-recording.sh <file> <session id>
f="$1"
id="$2"
[ -f "$f" ] || exit 0
case "$id" in *[!A-Za-z0-9_-]*|"") exit 0 ;; esac
. /etc/recuidado/upload.env 2>/dev/null || true
if [ -z "${API_URL:-}" ] || [ -z "${VOICE_API_TOKEN:-}" ]; then
  exit 0
fi
(
  for wait in 2 4 8 16; do
    if curl -sf -m 60 -X POST \
      -H "Authorization: Bearer $VOICE_API_TOKEN" \
      -H "Content-Type: audio/wav" \
      --data-binary "@$f" \
      "${API_URL%/}/call-logs/$id/recording"; then
      rm -f "$f"
      exit 0
    fi
    sleep "$wait"
  done
  echo "recording upload failed for $id, kept at $f" >&2
) &
