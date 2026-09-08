/**
 * twitter-api45(RapidAPI) 클라이언트와 프로필 조회. 논쟁 추출(extract-eth-debates)과 프로필 동기화(sync-x-profiles)가 같이 쓴다.
 */
import { avatarLarge, type XProfile } from './eth-debates';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** twitter-api45 호출. 키가 없거나 실패하면 null — 답글·아바타 없이도 추출은 진행된다. */
export function makeXApi() {
  const key = process.env.X_RAPIDAPI_KEY;
  const host = process.env.X_RAPIDAPI_HOST ?? 'twitter-api45.p.rapidapi.com';
  if (!key) {
    console.log('[INFO] X_RAPIDAPI_KEY not set — replies, engagement and avatars skipped');
    return null;
  }
  // 20초 타임아웃, 5xx·네트워크 오류는 한 번 재시도. 타임아웃이 없으면 끊긴 연결 하나에 전체 실행이 멈춘다.
  return async (endpoint: string, params: Record<string, string>): Promise<Record<string, unknown> | null> => {
    const qs = new URLSearchParams(params).toString();
    for (let attempt = 0; attempt < 2; attempt++) {
      await sleep(attempt === 0 ? 500 : 3000);
      try {
        const res = await fetch(`https://${host}/${endpoint}.php?${qs}`, {
          headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
          signal: AbortSignal.timeout(20_000),
        });
        if (res.status >= 500 && attempt === 0) continue;
        if (!res.ok) {
          console.warn(`[WARN] x ${endpoint} ${qs}: HTTP ${res.status}`);
          return null;
        }
        const body = await res.text();
        return body ? (JSON.parse(body) as Record<string, unknown>) : null;
      } catch (error) {
        if (attempt === 0) continue;
        console.warn(`[WARN] x ${endpoint} ${qs}:`, error instanceof Error ? error.message : error);
        return null;
      }
    }
    return null;
  };
}

/** 프로필 캐시에 없는 핸들을 screenname.php로 채운다 (이름·아바타·팔로워·바이오) */
export async function fetchProfiles(handles: Iterable<string>, profiles: Record<string, XProfile>, xApi: ReturnType<typeof makeXApi>, needBio = false) {
  if (!xApi) return;
  for (const handle of new Set(handles)) {
    const key = handle.toLowerCase();
    if (profiles[key] && (!needBio || profiles[key].bio !== undefined)) continue;
    const p = await xApi('screenname', { screenname: handle });
    if (!p?.profile) continue;
    profiles[key] = {
      ...profiles[key],
      handle: String(p.profile),
      name: String(p.name ?? handle),
      avatar: avatarLarge(p.avatar ? String(p.avatar) : undefined) ?? profiles[key]?.avatar,
      followers: Number(p.sub_count ?? 0),
      bio: String(p.desc ?? ''),
    };
  }
}
