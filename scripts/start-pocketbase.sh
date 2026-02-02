#!/usr/bin/env sh
# Start PocketBase with deploy env (SITE_DEPLOY_TOKEN, SITE_ROOT, SITE_URL).
# Usage: ./scripts/start-pocketbase.sh
# Loads .env from project root if present.

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  . .env
  set +a
fi

export SITE_DEPLOY_TOKEN="${SITE_DEPLOY_TOKEN:-sk_deploy_xxxxxxxx}"
export SITE_ROOT="${SITE_ROOT:-$PWD/site}"
export SITE_URL="${SITE_URL:-https://www.example.com}"

mkdir -p site/releases

exec ./pocketbase/pocketbase serve --dev
