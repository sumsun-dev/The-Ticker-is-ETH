#!/usr/bin/env bash
# VPS 크론용 다이제스트 러너. 크론은 매일 돌지만 실제 발행은 generate-eth-digest.ts의 DIGEST_INTERVAL_DAYS(3일) 주기.
#   수집(GH Actions 00:00 UTC) 완료 후 실행: git pull → 헤드리스 생성 → 텔레그램 송출 → 커밋·푸시
#
# VPS 셋업 (1회):
#   1) 리포 클론 + npm ci
#   2) claude CLI 설치·로그인 (구독 인증 — API 키 불필요)
#   3) .env에 TELEGRAM_BOT_TOKEN 설정
#   4) crontab: 40 0 * * * /home/gv/projects/the-ticker-is-eth/scripts/vps/run-eth-digest.sh >> ~/logs/eth-digest.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."

# --autostash: 이전 실행이 남긴 미커밋 산출물이 있어도 pull이 막히지 않게
git pull --rebase --autostash origin main
npx tsx scripts/generate-eth-digest.ts
npx tsx scripts/render-digest-cover.ts
npx tsx scripts/post-digest-telegram.ts

git add src/data/eth-digests.json public/assets/digests/
git diff --cached --quiet || (
  git commit -m "chore: publish eth digest [automated]" &&
  git pull --rebase --autostash origin main &&
  git push origin main
)
