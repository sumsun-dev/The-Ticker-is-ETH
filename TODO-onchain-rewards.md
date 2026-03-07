# 온체인 보상 시스템 TODO

## 사전 준비
- [ ] thirdweb 가입 (지갑 연결)
- [ ] thirdweb API Key (Client ID) 발급
- [ ] Admin 지갑에 Base ETH 확보 (가스비용)

## 스마트 컨트랙트 (thirdweb 대시보드)
- [ ] Edition Drop (ERC-1155) 컨트랙트 Base 체인에 배포
- [ ] 배지 종류 등록 (이미지 + 메타데이터)
  - Token 0: 핵심 기여자
  - Token 1: 번역가
  - Token 2: 이벤트 참석
  - Token 3: 리서치 작성자
  - (필요 시 추가)
- [ ] 각 배지별 Claim Conditions 설정 (무료, allowlist, 1인 1개)

## 코드 구현
- [ ] `npm install thirdweb`
- [ ] thirdweb + Privy wallet adapter 연결
- [ ] 기여자 Claim 페이지/버튼 (ClaimButton)
- [ ] Admin 보상 페이지 (기여자 선택 → mint 실행)
- [ ] 프로필 페이지에 보유 배지 표시

## 토큰 보상 (Phase 2)
- [ ] ERC-20 토큰 설계 (커뮤니티 토큰 여부 결정)
- [ ] 토큰 전송 기능 (Admin → 기여자)

## 기획 메모
- 보상 실행: Admin + 기여자 본인 Claim 둘 다
- 보상 종류: SBT(증명) + 토큰(보상) 복합
- 보상 기준: 텔레그램 활동, 리서치/번역, 이벤트 참석, Admin 재량
- 체인: Base (가스비 ~$0.01/건)
- 플랫폼: thirdweb (대시보드 no-code + React SDK)
