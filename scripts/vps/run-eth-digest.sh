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
#              0 14 * * * cd /home/gv/projects/the-ticker-is-eth && git pull -q --rebase --autostash origin main && scripts/vps/run-eth-digest.sh standards >> ~/logs/eth-digest.log 2>&1
#      네 번째 줄은 23:00 KST EIP·ERC 해설 채우기. 크론 줄에서 먼저 pull해 standards 모드가 없는 옛 러너가 다이제스트를 돌리지 않게 한다.
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

  # 밤 실행: EIP·ERC 해설을 하루 STANDARDS_PER_DAY(기본 50)개씩 채운다 (오너 2026-11-03 「하루에 각각 30개씩, 다 완료될때까지」, 2026-11-04 「하루 50개씩으로 늘리자」)
  # 종류마다 작업자 2개(샤드)라 4개가 동시에 돈다. VPS에선 해설 하나에 약 4분이라 50개면 2시간 남짓, 아침 다이제스트 전에 끝나게 5시간으로 끊는다.
  # 다 채우면 대상이 없어 바로 끝나고, 이후엔 원문이 바뀐 것만 다시 쓴다
  if [ "${1:-}" = standards ]; then
    local half=$(( (${STANDARDS_PER_DAY:-50} + 1) / 2 )) i
    mkdir -p "$HOME/logs"
    for i in 1 2; do
      EIPS_SCOPE=all EIPS_SHARD=$i/2 EIPS_LIMIT=$half timeout 5h npx tsx scripts/extract-eips.ts > "$HOME/logs/eips-$i.log" 2>&1 &
      ERCS_SHARD=$i/2 ERCS_LIMIT=$half timeout 5h npx tsx scripts/extract-ercs.ts > "$HOME/logs/ercs-$i.log" 2>&1 &
    done
    wait
    tail -n 3 "$HOME"/logs/eips-?.log "$HOME"/logs/ercs-?.log
    # 사용량 한도에 걸리면 다이제스트·브리프도 같은 계정이라 멈출 수 있어 오너에게 알린다
    if grep -qiE "hit your .*limit" "$HOME"/logs/eips-?.log "$HOME"/logs/ercs-?.log; then
      notify_owner "[EIP·ERC 해설] 사용량 한도에 걸렸습니다. STANDARDS_PER_DAY를 줄이거나 크론을 잠시 멈춰 주세요.
$(grep -hiE -m2 "hit your .*limit" "$HOME"/logs/eips-?.log "$HOME"/logs/ercs-?.log)"
    fi
    commit_and_push "chore: publish eip/erc explainers [automated]"
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

  # 콜에 나온 EIP 해설(쉬운 설명+심층 설명). EIP당 모델 8분 남짓이라 송출이 다 끝난 뒤에 돌리고 45분으로 끊는다.
  # EIP마다 저장하므로 끊겨도 쓴 것까지는 남고 다음 실행이 이어 간다. 실패해도 커밋은 진행
  timeout 45m npx tsx scripts/extract-eips.ts || true

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

# 영어판: 방금 쓴 한국어 데이터에서 아직 영어가 없는 문장만 번역해 src/data/en 사전에 채운다 (scripts/translate-en.ts).
# 새 문장이 없으면 모델을 부르지 않고 바로 끝난다. 실패해도 한국어 발행은 진행하고, 남은 문장은 다음 실행이 이어 간다
# 한국어 발행(커밋·푸시)이 끝난 뒤에 돈다: 번역이 오래 걸려도 한국어 새 글이 사이트에 늦게 뜨지 않는다.
# 다른 실행이 번역 중이면(flock) 건너뛴다. 같은 사전 파일을 둘이 쓰면 나중 것이 앞 것을 덮는다
translate_en() {
  local status=0
  flock -n /tmp/eck-translate-en.lock timeout 60m npx tsx scripts/translate-en.ts || status=$?
  # 2: 사용량 한도(다이제스트·브리프도 같은 계정). 그 밖의 실패도 오너에게 알린다. 124 는 시간 초과로, 쓴 데까지 남고 다음 실행이 이어 간다
  if [ "$status" -eq 2 ]; then
    notify_owner "[영어판 번역] 사용량 한도에 걸려 멈췄습니다. 남은 문장은 다음 실행에서 이어 갑니다."
  elif [ "$status" -ne 0 ] && [ "$status" -ne 124 ]; then
    notify_owner "[영어판 번역] 실패했습니다 (exit $status). 다른 실행이 번역 중이었다면 무시해도 됩니다."
  fi
  git add src/data/en/
  git diff --cached --quiet && return 0
  # 푸시까지 못 가면(사전 충돌 등) 이 커밋만 버린다. rebase 중간 상태로 남으면 다음 실행의 pull 부터 막혀 발행 전체가 멈춘다
  if ! (git commit -q -m "chore: sync english dictionaries [automated]" && git pull --rebase --autostash origin main && git push origin main); then
    git rebase --abort 2>/dev/null || true
    git reset -q --hard origin/main
    notify_owner "[영어판 번역] 사전 커밋을 올리지 못해 버렸습니다. 다음 실행에서 다시 번역합니다."
  fi
}

commit_and_push() {
  publish_ko "$1"
  translate_en
}

publish_ko() {
  git add src/data/eth-digests.json src/data/eth-debates.json src/data/eth-calls.json src/data/x-profiles.json src/data/weekly-briefs.json src/data/eips.json src/data/ercs.json src/data/erc-index.json public/assets/digests/
  git diff --cached --quiet || (
    git commit -m "$1" &&
    git pull --rebase --autostash origin main &&
    git push origin main
  )
}

main "$@"
