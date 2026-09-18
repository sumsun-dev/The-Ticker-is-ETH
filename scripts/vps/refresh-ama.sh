#!/usr/bin/env bash
# 레딧 AMA 재확인 — 스레드에 답변이 더 붙었을 때만 다시 정리하고, 브리프를 채널에 올린다.
# (오너 2026-09-18: Pt.15를 수동으로 올린 뒤 자동 전환 승인.)
#
# 사용: refresh-ama.sh <스레드 URL> <회차> <날짜> <제목>
# 상태: ~/.eck-ama-<회차>.items — 마지막으로 정리한 시점의 항목 수. 늘지 않았으면 그냥 끝낸다.
set -euo pipefail

URL=$1; NUM=$2; DATE=$3; TITLE=$4
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$HOME/.eck-ama-$NUM.items"
FEED="$(mktemp)"
UA='eck-news-bot/1.0 (+https://ethcollective.xyz)'
trap 'rm -f "$FEED"' EXIT

cd "$REPO"
git fetch origin -q
git rebase --autostash origin/main -q

# 레딧은 403·429를 간헐적으로 돌려준다. 간격을 두고 다시 받는다
code=000
for i in 1 2 3 4; do
  code=$(curl -sL -A "$UA" "${URL%/}/.rss?limit=500" -o "$FEED" -w '%{http_code}')
  [ "$code" = 200 ] && break
  echo "[WARN] 레딧 피드 http $code ($i/4)"
  sleep 30
done
[ "$code" = 200 ] || { echo "[ERROR] 피드 수신 실패 (http $code)"; exit 1; }

items=$(grep -o '<entry>' "$FEED" | wc -l | tr -d ' ')
prev=$(cat "$STATE" 2>/dev/null || echo 0)
echo "$(date -u +%FT%TZ) AMA #$NUM 항목 $items (지난번 $prev)"
if [ "$items" -le "$prev" ]; then
  echo "[SKIP] 새 답변 없음"
  exit 0
fi

npx tsx scripts/extract-reddit-ama.ts --url "$URL" --file "$FEED" --number "$NUM" --date "$DATE" --title "$TITLE"
git add src/data/eth-calls.json
git commit -q -m "chore: 레딧 AMA Pt.$NUM 정리 갱신 [automated]"
git fetch origin -q
git rebase --autostash origin/main -q
git push -q origin main
echo "$items" > "$STATE"

# 브리프를 채널에 올린다. 게시하면 telegramMessageId가 박히므로 그대로 커밋해
# 다음 실행(여기서도, 매일 도는 run-eth-digest.sh에서도)이 같은 회차를 다시 올리지 않는다
CALLS_CHAT=@thetickeriseth CALLS="ama-$NUM" npx tsx scripts/post-calls-telegram.ts
git add src/data/eth-calls.json
git diff --cached --quiet || (
  git commit -q -m "chore: 레딧 AMA Pt.$NUM 채널 게시 기록 [automated]" &&
  git fetch origin -q &&
  git rebase --autostash origin/main -q &&
  git push -q origin main
)
echo "완료"
