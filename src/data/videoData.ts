/**
 * 영상 콘텐츠. 지금은 EthereumKorea YouTube 채널에 올라온 EK1 Genesis 세션 영상이다.
 * 순서는 행사 진행 순이고, Day 2 영상은 sessionId로 ek1-genesis.json 세션과 이어진다.
 * 두 JSON은 scripts/fetch-youtube-videos.ts가 YouTube 설명란에서 만든다.
 */
import data from './videos.json';
import type { VideoChapter } from '../utils/youtubeDescription';

export type VideoDay = 1 | 2;

export interface VideoItem {
    /** YouTube 영상 ID */
    id: string;
    title: string;
    event: string;
    day: VideoDay;
    /** 행사 날짜 */
    date: string;
    duration: string;
    sessionId?: string;
    /** YouTube 업로드 시각 (ISO 8601) */
    uploadDate: string;
    seconds: number;
    /** 설명란 도입 문단 */
    summary: string;
    /** "이름, 직함" 줄. 모더레이터는 "Moderator: " 접두 */
    speakers: string[];
    lang: 'ko' | 'en';
}

/** 상세 페이지·SEO 전용 (목록 번들에는 넣지 않는다) */
export interface VideoDetail {
    about: string;
    takeaways: string[];
    chapters: VideoChapter[];
}

export const VIDEOS = data as VideoItem[];
export const VIDEO_CHANNEL_URL = 'https://www.youtube.com/@EthereumKorea/videos';
export const VIDEO_DAYS: readonly VideoDay[] = [1, 2];

export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const maxThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}`;
/** 페이지 임베드 플레이어. 챕터(?t=)로 들어오면 그 시각부터 바로 재생한다 */
export const playerUrl = (id: string, start?: number) => (start ? `${embedUrl(id)}?start=${start}&autoplay=1` : embedUrl(id));
export const VIDEO_ID_RE = /^[\w-]{11}$/;
export const videoPagePath = (id: string) => `/contents/videos/${id}`;

export const findVideo = (id: string | undefined) => VIDEOS.find((v) => v.id === id);

export const videosByDay = (day: VideoDay, videos: VideoItem[] = VIDEOS) => videos.filter((v) => v.day === day);

export const filterVideos = (videos: VideoItem[], query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) => v.title.toLowerCase().includes(q) || v.speakers.some((s) => s.toLowerCase().includes(q)));
};

export const loadVideoDetails = async (): Promise<Record<string, VideoDetail>> =>
    (await import('./video-details.json')).default as Record<string, VideoDetail>;
