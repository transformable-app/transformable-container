#!/usr/bin/env sh
set -e

cd /app

if [ -n "${SUPERUSER_EMAIL:-}" ] || [ -n "${SUPERUSER_PASS:-}" ]; then
  if [ -z "${SUPERUSER_EMAIL:-}" ] || [ -z "${SUPERUSER_PASS:-}" ]; then
    echo "SUPERUSER_EMAIL and SUPERUSER_PASS must both be set." >&2
    exit 1
  fi

  ./pocketbase superuser upsert "$SUPERUSER_EMAIL" "$SUPERUSER_PASS"
fi

exec ./pocketbase serve --http=0.0.0.0:8090
