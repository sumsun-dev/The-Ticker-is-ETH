# The Ticker is ETH

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

한국 이더리움 커뮤니티를 위한 퍼블릭 굿즈 웹사이트.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 3 + Framer Motion
- **3D**: Three.js + React Three Fiber
- **Routing**: React Router DOM 7
- **Data**: Telegram API 기반 실데이터 매핑
- **i18n**: react-i18next (한국어/영어 전환)
- **Auth**: Privy (지갑/Google/Twitter 로그인 + 임베디드 지갑)
- **Sanitization**: DOMPurify (XSS 방지)

## Features

- Hero 섹션 (멤버 아바타 애니메이션)
- Core Team / Contributors 프로필 (소셜 링크, 기여 히트맵, Stats 배너)
- Research 블로그 (작성/열람, 패스프레이즈 인증, Telegram 카테고리, 동적 로딩 + Load More 페이지네이션)
- News 페이지 (이더리움 주간 리서치 리포트 by @r2jamong, RSS 기반)
- Events 페이지
- 다국어 지원 (한국어 기본, 영어 전환 — KO/EN 토글)
- 이더리움 다이아몬드 커스텀 커서 + Trail 효과 (데스크탑)
- Telegram 채널 메시지 기반 기여도 분석
- Route 기반 Code-Splitting (React.lazy + Suspense)
- Privy 지갑/소셜 로그인 + 프로필 페이지

## Project Structure

```
src/
├── components/
│   ├── common/          # LanguageToggle, AnimatedNumber, AuthButton
│   ├── cursor/          # 커스텀 커서 (ETH 다이아몬드 + trail)
│   ├── home/            # Hero, KoreanFlagFlow, MemberAvatarFlow
│   └── team/            # MemberCard, ContributionGraph
├── i18n/                # i18n 초기화 + 번역 JSON (ko/, en/)
├── data/                # mockData, researchData, 전처리 JSON (team-enrichment, research-index, articles/)
├── layouts/             # MainLayout
├── pages/               # Home, About, Team, Contributors, Research, News, Events, Profile
├── types/               # TypeScript 타입 정의
└── utils/               # 공유 헬퍼 (telegram, members)
```

## Getting Started

```bash
npm install
cp .env.example .env.local  # VITE_PRIVY_APP_ID 설정
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint 실행 |
| `npm run fetch:telegram` | Telegram 채널 데이터 수집 (로컬) |
| `npm run preprocess:telegram` | Telegram 데이터 전처리 (team-enrichment + research-index + 개별 article .md 생성) |
| `npm run fetch:news` | RSS 뉴스 피드 수집 (eth.rejamong.com) |

## Deployment

Vercel을 통한 자동 배포 (main 브랜치 push 시).

## Telegram Data Sync

GitHub Actions cron이 매일 KST 09:00에 Telegram 채널 데이터를 수집 → 전처리(개별 article .md 파일 생성) → RSS 뉴스 피드 수집하여 커밋합니다.
수동 실행: Actions 탭 → Sync Telegram Data → Run workflow.

필요한 GitHub Secrets: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`

## Environment Variables

| 변수 | 위치 | 용도 |
|------|------|------|
| `VITE_PRIVY_APP_ID` | 프론트엔드 | Privy SDK 초기화 (지갑/소셜 로그인) |

## Contributing

기여를 환영합니다! [CONTRIBUTING.md](./CONTRIBUTING.md)를 읽어주세요.

- 버그 발견 시 → [Bug Report](https://github.com/sumsun-dev/The-Ticker-is-ETH/issues/new?template=bug_report.md)
- 기능 제안 → [Feature Request](https://github.com/sumsun-dev/The-Ticker-is-ETH/issues/new?template=feature_request.md)
- `good first issue` 라벨이 붙은 이슈는 처음 기여하기 좋은 작업입니다.

## License

[MIT](./LICENSE)
