#!/usr/bin/env sh
# Deploy a site zip to the local PocketBase deploy API (skills.md).
# Usage: ./scripts/deploy.sh [path/to/site.zip] [message]
# Env: PB_BASE_URL (default http://127.0.0.1:8090), SITE_DEPLOY_TOKEN (required).

set -e
cd "$(dirname "$0")/.."

ZIP="${1:-site-build/site.zip}"
MESSAGE="${2:-deploy}"

if [ -z "$SITE_DEPLOY_TOKEN" ]; then
  if [ -f .env ]; then
    set -a
    . .env
    set +a
  fi
fi

if [ -z "$SITE_DEPLOY_TOKEN" ]; then
  echo "SITE_DEPLOY_TOKEN is not set. Set it in .env or the environment."
  exit 1
fi

BASE="${PB_BASE_URL:-http://127.0.0.1:8090}"
if [ ! -f "$ZIP" ]; then
  echo "Zip not found: $ZIP"
  exit 1
fi

echo "Deploying $ZIP to $BASE/api/site/deploy ..."
OUT=".deploy-out.$$"
CODE=$(curl -s -o "$OUT" -w "%{http_code}" -X POST "$BASE/api/site/deploy" \
  -H "Authorization: Bearer $SITE_DEPLOY_TOKEN" \
  -F "file=@$ZIP" \
  -F "message=$MESSAGE")
cat "$OUT"; rm -f "$OUT"
echo "HTTP $CODE"
if [ "$CODE" = "000" ]; then
  echo "Connection failed. Is PocketBase running? Try: ./scripts/start-pocketbase.sh"
  exit 1
fi
if [ "$CODE" -ge 400 ] 2>/dev/null; then
  exit 1
fi
if [ "$CODE" = "200" ]; then
  echo "Deploy complete."
fi
