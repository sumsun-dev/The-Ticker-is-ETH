#!/usr/bin/env bash
# Devcon 8 한국어 스크립트를 넣고 PR 까지 올린다.
# 사용: bash ~/ECK/scripts/add-devcon8-transcripts.sh <파일 또는 폴더>...
#   파일 이름은 <발표 id>.md (예: fast-ethereum.md). 폴더를 주면 안의 *.md 를 모두 넣는다.
#   발표 id 목록과 파일 형식은 docs/devcon8-transcripts.md
set -euo pipefail

REPO="$(cd "$(dirname "$(realpath "$0")")/.." && pwd)"
DEST="$REPO/src/data/devcon8-transcripts"

if [ $# -eq 0 ]; then
  echo "사용: bash $REPO/scripts/add-devcon8-transcripts.sh <파일 또는 폴더>..." >&2
  exit 1
fi

# 발표 id: 기존 8개(devcon8Data.ts) + 추가 8개(devcon8-talks.json)
IDS="$( { grep -oE "^        id: '[a-z0-9-]+'" "$REPO/src/data/devcon8Data.ts" | cut -d"'" -f2
          grep -oE '"id": "[a-z0-9-]+"' "$REPO/src/data/devcon8-talks.json" | cut -d'"' -f4; } | sort -u )"

FILES=()
for arg in "$@"; do
  if [ -d "$arg" ]; then
    for f in "$arg"/*.md; do [ -e "$f" ] && FILES+=("$f"); done
  elif [ -f "$arg" ]; then
    FILES+=("$arg")
  else
    echo "없는 경로: $arg" >&2; exit 1
  fi
done
[ ${#FILES[@]} -gt 0 ] || { echo ".md 파일이 없습니다." >&2; exit 1; }

BAD=0
for f in "${FILES[@]}"; do
  id="$(basename "$f" .md)"
  if ! grep -qx "$id" <<<"$IDS"; then
    echo "알 수 없는 발표 id: $id ($(basename "$f"))" >&2; BAD=1
  fi
done
if [ $BAD -ne 0 ]; then
  echo "쓸 수 있는 파일 이름:" >&2; sed 's/$/.md/; s/^/  /' <<<"$IDS" >&2; exit 1
fi

cd "$REPO"
BRANCH="content/devcon8-transcripts-$(date +%m%d-%H%M)"
git fetch -q origin main
git switch -q -c "$BRANCH" origin/main
mkdir -p "$DEST"
for f in "${FILES[@]}"; do cp "$f" "$DEST/"; done

git add "$DEST"
if git diff --cached --quiet; then
  echo "바뀐 내용이 없습니다 (같은 파일이 이미 있음)." >&2; exit 1
fi
NAMES="$(git diff --cached --name-only | xargs -n1 basename | sed 's/\.md$//' | paste -sd, - | sed 's/,/, /g')"
git commit -q -m "content(events): Devcon 8 한국어 스크립트 추가 ($NAMES)"
git push -q -u origin "$BRANCH"
gh pr create --base main --head "$BRANCH" \
  --title "content(events): Devcon 8 한국어 스크립트 추가" \
  --body "추가한 스크립트: $NAMES

/events/devcon-8 의 해당 발표에 「한국어 스크립트」 버튼이 생깁니다."
echo "완료. 머지하면 10분 안에 사이트에 반영됩니다: gh pr merge --squash --delete-branch"
