#!/usr/bin/env bash
# /opt/ethcollective/deploy.sh — cron이 10분마다 실행. 새 커밋 있을 때만 빌드+배포.
# 수동 강제 배포: ./deploy.sh --force
set -euo pipefail

REPO=/opt/ethcollective/repo
WEBROOT=/var/www/ethcollective

cd "$REPO"
git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi

echo "[deploy] $(date -Is) ${LOCAL:0:7} -> ${REMOTE:0:7}"
git reset --hard origin/main --quiet

npm ci --no-audit --no-fund
npm run build

npx esbuild server/index.ts --bundle --platform=node --target=node20 --format=esm \
  --outfile=dist-server/api.mjs

rsync -a --delete dist/ "$WEBROOT"/
install -m 644 dist-server/api.mjs /opt/ethcollective/api.mjs
systemctl restart ethcollective-api

echo "[deploy] $(date -Is) done ${REMOTE:0:7}"
