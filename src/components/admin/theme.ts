/** 성과 대시보드 채널 색과 숫자 표기. 파랑 계열이 겹치지 않게 홈페이지는 보라, 링크드인은 앰버로 구분한다 */
export const CHANNEL = {
  site: { label: '홈페이지', color: '#A086FC' },
  telegram: { label: '텔레그램', color: '#26A5E4' },
  linkedin: { label: '링크드인', color: '#F2B544' },
  overall: { label: '전체', color: '#629FFF' },
} as const;
export type ChannelKey = keyof typeof CHANNEL;

export const n = (x: number) => x.toLocaleString('en-US');
