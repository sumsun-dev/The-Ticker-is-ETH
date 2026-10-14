#!/usr/bin/env bash
# VPS 크론용 다이제스트 러너. 크론은 매일 돌지만 실제 발행은 generate-eth-digest.ts의 DIGEST_INTERVAL_DAYS(3일) 주기.
#   수집(GH Actions 00:00 UTC) 완료 후 실행: git pull → 헤드리스 생성 → 텔레그램 송출 → 커밋·푸시
#
# VPS 셋업 (1회):
#   1) 리포 클론 + npm ci
#   2) claude CLI 설치·로그인 (구독 인증 — API 키 불필요)
#   3) .env에 TELEGRAM_BOT_TOKEN 설정
#   4) crontab: 40 0 * * * /home/gv/projects/the-ticker-is-eth/scripts/vps/run-eth-digest.sh >> ~/logs/eth-digest.log 2>&1
#              0 9 * * * /home/gv/projects/the-ticker-is-eth/scripts/vps/run-eth-digest.sh calls >> ~/logs/eth-digest.log 2>&1
#              0 10 * * 0 /home/gv/projects/the-ticker-is-eth/scripts/vps/run-eth-digest.sh weekly >> ~/logs/eth-digest.log 2>&1
#      두 번째 줄은 저녁(18:00 KST) 콜 브리프 게시. 다이제스트가 올라간 날 아침엔 콜을 미뤄 두 글이 겹치지 않게 한다.
#      세 번째 줄은 일요일 19:00 KST 기자 그룹방 주간 브리프 (.env에 WEEKLY_CHAT 필요).
set -euo pipefail

# 본문을 함수로 감싼다: bash는 함수 정의를 끝까지 파싱한 뒤 실행하므로, 아래 git pull이 이 파일을 바꿔도
# 실행 중인 러너는 영향을 받지 않는다 (2026-09-09: pull 직후 새 단계 sync-x-profiles·extract-eth-calls가 건너뛰어진 사고).
main() {
  cd "$(dirname "$0")/../.."

  # --autostash: 이전 실행이 남긴 미커밋 산출물이 있어도 pull이 막히지 않게
  git pull --rebase --autostash origin main

  # 저녁 실행: 아침에 미뤄 둔 콜 브리프만 올린다
  if [ "${1:-}" = calls ]; then
    CALLS_CHAT=@thetickeriseth npx tsx scripts/post-calls-telegram.ts || true
    commit_and_push "chore: publish call briefs [automated]"
    return
  fi

  # 일요일 저녁 실행: 기자 그룹방 주간 브리프 (월~일)
  # 실패하거나 경고(윤문 실패·항목 삭제·출처 제거)가 있으면 오너 DM으로 알린다 (오너 2026-10-14)
  if [ "${1:-}" = weekly ]; then
    local out status=0
    out=$(npx tsx scripts/post-weekly-brief.ts 2>&1) || status=$?
    echo "$out"
    if [ "$status" -ne 0 ] || ! grep -q "Sent weekly brief" <<<"$out" || grep -q "\[WARN\]" <<<"$out"; then
      notify_owner "[주간 브리프] 확인 필요 (exit $status)
$(grep -v dotenv <<<"$out" | tail -15)"
    fi
    commit_and_push "chore: publish weekly press brief [automated]"
    return
  fi

  npx tsx scripts/generate-eth-digest.ts
  npx tsx scripts/sync-x-profiles.ts
  npx tsx scripts/extract-eth-debates.ts
  # 새 논쟁을 오너 DM으로 알린다. 노출 버튼 응답 처리는 5분 크론(notify-debates.ts --commit)이 맡는다. 실패해도 나머지는 진행
  npx tsx scripts/notify-debates.ts || true
  npx tsx scripts/extract-eth-calls.ts
  npx tsx scripts/render-digest-cover.ts
  local before after
  before=$(latest_digest_message_id)
  npx tsx scripts/post-digest-telegram.ts
  after=$(latest_digest_message_id)
  # 새로 정리된 코어 개발자 콜 브리프를 채널에 (올린 콜은 eth-calls.json에 telegramMessageId 기록). 실패해도 커밋은 진행
  # 방금 다이제스트를 올렸으면 콜은 저녁 실행(calls)으로 미룬다. 같은 시각에 올라오면 하나가 묻힌다(오너, 2026-09-30)
  if [ "$after" != "$before" ]; then
    echo "[DEFER] digest posted this morning, call briefs go out in the evening run"
  else
    CALLS_CHAT=@thetickeriseth npx tsx scripts/post-calls-telegram.ts || true
  fi

  commit_and_push "chore: publish eth digest [automated]"
}

latest_digest_message_id() {
  node -p "require('./src/data/eth-digests.json').digests[0]?.telegramMessageId ?? ''"
}

# 오너 DM 알림. .env를 source하지 않고 필요한 값만 읽는다 (값에 셸 특수문자가 있어도 안전)
notify_owner() {
  local token chat
  token=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2-)
  chat=$(grep -m1 '^VITALIK_ALERT_CHAT=' .env | cut -d= -f2-)
  [ -n "$token" ] && [ -n "$chat" ] || { echo "[WARN] notify_owner: token/chat 없음"; return 0; }
  curl -s -o /dev/null "https://api.telegram.org/bot$token/sendMessage" \
    --data-urlencode "chat_id=$chat" --data-urlencode "text=${1:0:3500}" || echo "[WARN] notify_owner 전송 실패"
}

commit_and_push() {
  git add src/data/eth-digests.json src/data/eth-debates.json src/data/eth-calls.json src/data/x-profiles.json src/data/weekly-briefs.json public/assets/digests/
  git diff --cached --quiet || (
    git commit -m "$1" &&
    git pull --rebase --autostash origin main &&
    git push origin main
  )
}

main "$@"
