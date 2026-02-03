#!/usr/bin/env sh
# Rollback to the previous revision (skills.md).
# Usage: ./scripts/rollback.sh [revisionId]
#   With no argument: rollback to the previous revision.
#   With revisionId: rollback to that revision.
# Env: PB_BASE_URL (default http://127.0.0.1:8090), SITE_DEPLOY_TOKEN (required).

set -e
cd "$(dirname "$0")/.."

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

if [ -n "$1" ]; then
  REVISION_ID="$1"
else
  echo "Fetching revisions..."
  REV=$(curl -s -H "Authorization: Bearer $SITE_DEPLOY_TOKEN" "$BASE/api/site/revisions?limit=20")
  REVISION_ID=$(echo "$REV" | jq -r '.items[1].id // empty')
  if [ -z "$REVISION_ID" ]; then
    if ! echo "$REV" | grep -q '"items"'; then
      echo "Failed to fetch revisions (check SITE_DEPLOY_TOKEN and PB_BASE_URL): $REV"
      exit 1
    fi
    echo "No previous revision to rollback to."
    exit 1
  fi
  echo "Rolling back to previous revision: $REVISION_ID"
fi

OUT=".deploy-out.$$"
BODYFILE=".rollback-body.$$"
printf '{"revisionId":"%s"}\n' "$REVISION_ID" > "$BODYFILE"
CODE=$(curl -s -o "$OUT" -w "%{http_code}" -X POST "$BASE/api/site/rollback" \
  -H "Authorization: Bearer $SITE_DEPLOY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "@$BODYFILE")
rm -f "$BODYFILE"
cat "$OUT"; rm -f "$OUT"
echo "HTTP $CODE"
if [ "$CODE" = "000" ]; then
  echo "Connection failed. Is PocketBase running?"
  exit 1
fi
if [ "$CODE" -ge 400 ] 2>/dev/null; then
  exit 1
fi
if [ "$CODE" = "200" ]; then
  echo "Rollback complete."
fi
