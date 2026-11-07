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

## 5. Ethereum TV 강연을 번역해서 넣기

Ethereum TV는 영어 원문을 확인하는 곳이고, 번역 파일을 올리는 곳은 ECK 저장소입니다.
Ethereum TV URL의 마지막 부분(slug)을 그대로 파일 이름으로 쓰지 말고, 위 표의 ECK 발표 id를 사용하세요.

### 예시: 비탈릭 부테린의 개막 키노트

| 항목 | 값 |
|---|---|
| 원문 제목 | The Open Secure and Verifiable Half to a Brighter Future |
| 연사 | Vitalik Buterin (비탈릭 부테린) |
| 발표 | Devcon 8 · 2026년 11월 3일 · 16분 14초 |
| 영어 스크립트 | https://ethereumtv.co/talks/the-open-secure-and-verifiable-half-to-a-brighter-future |
| 원본 영상 | https://www.youtube.com/watch?v=nUFLz-o1YVY |
| ECK 발표 id | `opening-keynote` |
| 저장할 파일 | `src/data/devcon8-transcripts/opening-keynote.md` |
| 사이트에서 확인할 곳 | `/events/devcon-8` → 「개막 키노트」 → 「한국어 스크립트」 |

### 번역 준비와 검수

1. Ethereum TV의 Transcript에서 영어 스크립트를 복사합니다. 번역을 요청할 때는 URL과 함께 원문 텍스트도 직접 붙여 주세요. 길면 발표 순서대로 나누어 보내도 됩니다.
2. 아래 요청문과 함께 번역을 요청합니다. 전체 원문을 보내기 전에는 최종 파일을 만들지 않습니다.
3. 번역을 원문과 대조하고, 자막이 끊기거나 잘못 인식된 부분은 영상으로 확인합니다. 확인하지 못한 구절을 임의로 복원하지 않습니다.
4. 검수한 번역만 UTF-8 파일 `opening-keynote.md`로 저장합니다. 제목·문단·출처도 2절의 표시 규칙을 따릅니다.

번역 요청문:

```text
아래에 직접 붙인 영어 스크립트를 ECK 게시용 한국어 스크립트로 번역해 주세요.

- 요약하지 말고 발표 순서와 발언의 의미를 유지해 주세요.
- 반복되는 추임새는 자연스럽게 정리하되, 주장·예시·질문·유머는 유지해 주세요.
- 자막이 누락되거나 문맥을 판별할 수 없는 곳은 [원문 자막 불명확]으로 표시해 주세요.
- 소제목은 빈 줄로 분리한 '## 제목', 본문은 빈 줄로 나눈 문단만 사용해 주세요.
- 목록·표·굵게·마크다운 링크·코드 블록은 최종 번역 파일에 넣지 마세요.
- 프로젝트명과 기술 용어는 확인된 표기를 쓰고, 필요하면 첫 등장에 영문을 병기해 주세요.
- 파일 이름은 opening-keynote.md입니다.

[여기에 영어 원문 전체를 붙여 주세요]
```

이 강연에서 확인할 주요 표기는 d/acc, GrapheneOS, Qubes OS, 영지식 증명(ZKP),
완전동형암호(FHE), Farcaster, Lens, 종단간 암호화, 메타데이터입니다.
자동 자막의 표기와 다를 수 있으므로 문맥과 영상을 함께 확인하세요.

파일 마지막에는 출처와 번역 방식을 일반 문단으로 남깁니다. 아래 예시의 번역자·검수 상태는 실제 작업에 맞춰 고쳐 주세요.
URL은 현재 스크립트 패널에서 일반 텍스트로 표시됩니다.

```text
원문: Vitalik Buterin, The Open Secure and Verifiable Half to a Brighter Future · Devcon 8 · 2026-11-03

영어 스크립트: https://ethereumtv.co/talks/the-open-secure-and-verifiable-half-to-a-brighter-future

원본 영상: https://www.youtube.com/watch?v=nUFLz-o1YVY

한국어 번역: [번역자] · 번역 기준: Ethereum TV 영어 자막 · 검수 상태: [실제 검수 상태]
```

### 등록

번역 파일을 `~/Downloads/devcon8-ko/opening-keynote.md`에 저장했다면:

```bash
bash ~/ECK/scripts/add-devcon8-transcripts.sh ~/Downloads/devcon8-ko/opening-keynote.md
```

이 명령은 브랜치 생성부터 커밋·푸시·PR 생성까지 실행합니다.
최종 번역을 확인한 후 실행하고, 생성된 PR에서 변경 파일이 `opening-keynote.md`인지 확인하세요.
PR을 머지하면 기존 자동 배포를 통해 최대 10분 안에 반영됩니다.
초안이나 `[여기에 영어 원문 전체를 붙여 주세요]` 같은 안내 문구를 스크립트 파일로 등록하지 마세요.
