#!/usr/bin/env bash
# VPS 크론용 데일리 다이제스트 러너.
#   수집(GH Actions 00:00 UTC) 완료 후 실행: git pull → 헤드리스 생성 → 텔레그램 송출 → 커밋·푸시
#
# VPS 셋업 (1회):
#   1) 리포 클론 + npm ci
#   2) claude CLI 설치·로그인 (구독 인증 — API 키 불필요)
#   3) .env에 TELEGRAM_BOT_TOKEN 설정
#   4) crontab: 40 0 * * * /home/gv/projects/the-ticker-is-eth/scripts/vps/run-eth-digest.sh >> ~/logs/eth-digest.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."

git pull --rebase origin main
npx tsx scripts/generate-eth-digest.ts
npx tsx scripts/post-digest-telegram.ts

git add src/data/eth-digests.json
git diff --cached --quiet || (
  git commit -m "chore: publish daily eth digest [automated]" &&
  git pull --rebase origin main &&
  git push origin main
)
