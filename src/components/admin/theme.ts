/** 성과 대시보드 채널 색과 숫자 표기. 밝은 관리자 화면에서 읽히는 채도로 맞춘다 */
export const CHANNEL = {
  site: { label: '홈페이지', color: '#7357D6' },
  telegram: { label: '텔레그램', color: '#2481CC' },
  linkedin: { label: '링크드인', color: '#C27C0E' },
  overall: { label: '전체', color: '#52525B' },
} as const;
export type ChannelKey = keyof typeof CHANNEL;

export const n = (x: number) => x.toLocaleString('en-US');
