# Devcon 8 한국어 스크립트 넣는 방법

`/events/devcon-8` 페이지의 발표마다 「한국어 스크립트」 버튼을 붙이는 방법입니다.
파일을 하나 넣으면 그 발표에만 버튼이 생기고, 파일이 없는 발표에는 버튼이 나오지 않습니다.

## 1. 파일 위치와 이름

`src/data/devcon8-transcripts/<발표 id>.md`

파일 이름은 아래 표의 이름과 정확히 같아야 합니다. 다르면 버튼이 생기지 않습니다.

| 파일 이름 | 날짜 | 발표 | 연사 |
|---|---|---|---|
| `agents-trust.md` | 11.03 | AI 에이전트는 열린 환경에서 안전할 수 있을까 | 비탈릭 부테린 · 오드리 탕 |
| `ai-x-ethereum.md` | 11.03 | AI와 이더리움, 지금 어디까지 왔나 | 오스틴 그리피스 |
| `fast-finality-roadmap.md` | 11.03 | 16분에서 몇 초로: 이더리움 빠른 완결성 로드맵 | 얀 폰란텐 |
| `kernel-funding.md` | 11.03 | 이더리움 핵심 인프라에 누가, 얼마나 돈을 댈까 | 마틴 한센 (이더리움 재단) |
| `kohaku.md` | 11.03 | Kohaku: 모두를 위한 기본값 프라이버시 | 비탈릭 부테린 · 니콜라 콩시니 |
| `opening-keynote.md` | 11.03 | 개막 키노트: 열려 있고 안전하며 검증할 수 있는 미래 | 비탈릭 부테린 |
| `post-quantum.md` | 11.03 | 포스트퀀텀 전환과 Mission 2028 | 저스틴 드레이크 · Kev |
| `securing-ai.md` | 11.03 | AI 시대의 이더리움 보안: 과제와 기회 | 0xRajeev · 비탈릭 부테린 · 프레드릭 스반테스 · Mooly Sagiv · Josselin Feist |
| `fast-ethereum.md` | 11.04 | 빠른 이더리움 | 바르나베 모노 |
| `how-ethereum-scaled.md` | 11.04 | 이더리움은 어떻게 확장을 배웠나 | 토니 바르슈테터 |
| `institutions-onchain.md` | 11.04 | 온체인으로 오는 기관들 | 아리아만 찰라니 · 라슈미 아비게리 · 시모네 다미코 · 루치르 달미아 |
| `lean-ethereum.md` | 11.04 | 린 이더리움으로 가는 길 | 레안드로 페리뇨 · 이반 리테리 |
| `roadmap-simplified.md` | 11.04 | 쉽게 보는 이더리움 로드맵 | Cheeky Gorilla (Protocol Guild) |
| `robotics.md` | 11.04 | 이더리움과 로보틱스 | 토마스 스탄치크 |
| `vitalik-shetty.md` | 11.04 | 비탈릭 부테린과 시다르트 셰티의 대담 | 비탈릭 부테린 · 시다르트 셰티 · 덴버 |
| `steal-now-reveal-never.md` | 11.05 | 지금 훔치고 끝내 드러내지 않는다: 조용히 다가오는 양자 공격 | Shankara Pailoor |

## 2. 파일 형식

일반 텍스트(UTF-8)입니다. 규칙은 두 가지뿐입니다.

- 빈 줄 하나로 문단을 나눕니다.
- `## ` 로 시작하는 줄은 소제목으로 굵게 보입니다(선택).

```
## 들어가며

안녕하세요, 뭄바이에서 다시 뵙게 되어 반갑습니다. 오늘은 ...

## 슬롯 단축

12초 슬롯을 2027년에 10초로 줄이는 것이 첫 단계입니다. ...
```

그 밖의 마크다운(굵게, 링크, 목록)은 꾸밈 없이 글자 그대로 보입니다.
연사가 바뀌는 대담은 문단 앞에 `비탈릭:` 처럼 이름을 적어 주면 읽기 좋습니다.

## 3. 넣기 (한 줄)

번역 파일을 한 폴더에 모아 두고 터미널에서 실행합니다.

```bash
bash ~/ECK/scripts/add-devcon8-transcripts.sh ~/Downloads/devcon8-ko
```

파일 하나만 넣을 때는 폴더 대신 파일 경로를 줍니다(여러 개를 띄어 써도 됩니다).

```bash
bash ~/ECK/scripts/add-devcon8-transcripts.sh ~/Downloads/fast-ethereum.md
```

스크립트가 하는 일:
1. 파일 이름이 위 표의 발표 id 와 맞는지 확인합니다. 틀리면 쓸 수 있는 이름을 보여 주고 멈춥니다.
2. 최신 main 에서 새 브랜치(`content/devcon8-transcripts-날짜`)를 만들고 파일을 `src/data/devcon8-transcripts/` 에 복사합니다.
3. 커밋, 푸시, PR 생성까지 하고 PR 주소를 보여 줍니다.

PR 을 머지하면(`gh pr merge --squash --delete-branch`) VPS 가 10분 안에 사이트에 반영합니다.
같은 발표의 파일을 다시 넣으면 새 내용으로 바뀝니다.

## 4. 참고

- 「한국어 정리」(발표 흐름 요약)는 `src/data/devcon8-talks.json` 의 `flow` 에 있고, 스크립트와 별개로 계속 보입니다.
- 펼친 스크립트 칸은 화면 높이의 60%까지 커지고, 그보다 길면 칸 안에서 스크롤됩니다.
- 화면으로 먼저 보고 싶으면 파일을 `src/data/devcon8-transcripts/` 에 넣고 `npm run dev` 후 `http://localhost:5173/events/devcon-8` 에서 확인합니다.
- 출처 표기가 필요하면 파일 맨 끝에 문단으로 적어 주세요(예: `번역: ECK · 원문: Devcon 8, Ethereum Foundation`).
