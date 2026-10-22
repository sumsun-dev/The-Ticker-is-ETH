/**
 * 영상 콘텐츠. 지금은 EthereumKorea YouTube 채널에 올라온 EK1 Genesis 세션 영상이다.
 * 순서는 행사 진행 순이고, Day 2 영상은 sessionId로 ek1-genesis.json 세션과 이어진다.
 * 두 JSON은 scripts/fetch-youtube-videos.ts가 YouTube 제목·설명란(한국어·영어)에서 만든다.
 */
import data from './videos.json';
import type { VideoChapter } from '../utils/youtubeDescription';

export type VideoDay = 1 | 2;
export type VideoLang = 'ko' | 'en';
export const VIDEO_LANGS: readonly VideoLang[] = ['ko', 'en'];

/** 언어별 텍스트. 채널이 YouTube에 한국어·영어 제목과 설명을 모두 등록해 두었다 */
export interface VideoText {
    title: string;
    /** 설명란 도입 문단 */
    summary: string;
    /** "이름, 직함" 줄. 모더레이터는 "Moderator: "·"모더레이터: " 접두 */
    speakers: string[];
}

export interface VideoItem {
    /** YouTube 영상 ID */
    id: string;
    event: string;
    day: VideoDay;
    /** 행사 날짜 */
    date: string;
    duration: string;
    sessionId?: string;
    /** YouTube 업로드 시각 (ISO 8601) */
    uploadDate: string;
    seconds: number;
    /** 영상 음성(진행) 언어 */
    spokenLang: VideoLang;
    text: Record<VideoLang, VideoText>;
}

/** 한 언어로 펼친 영상. 화면과 구조화 데이터는 이 모양을 쓴다 */
export type LocalizedVideo = Omit<VideoItem, 'text'> & VideoText & { lang: VideoLang };

/** 상세 페이지·SEO 전용 (목록 번들에는 넣지 않는다) */
export interface VideoDetail {
    about: string;
    takeaways: string[];
    chapters: VideoChapter[];
}

export type VideoDetails = Record<string, Record<VideoLang, VideoDetail>>;

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

/** i18n 언어 코드 → 영상 텍스트 언어 (영어가 아니면 한국어) */
export const toVideoLang = (lng: string | undefined): VideoLang => (lng?.toLowerCase().startsWith('en') ? 'en' : 'ko');

export const localizeVideo = ({ text, ...rest }: VideoItem, lang: VideoLang): LocalizedVideo => ({ ...rest, ...text[lang], lang });

/** 구조화 데이터 입력. 페이지 기본 언어(한국어)로 쓰고 영어 제목을 별칭으로 붙인다 */
export const videoLdInput = (video: VideoItem) => ({ ...localizeVideo(video, 'ko'), alternateName: video.text.en.title });

export const findVideo = (id: string | undefined) => VIDEOS.find((v) => v.id === id);

export const videosByDay = (day: VideoDay, videos: VideoItem[] = VIDEOS) => videos.filter((v) => v.day === day);

export const filterVideos = (videos: VideoItem[], query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    const matches = (t: VideoText) => t.title.toLowerCase().includes(q) || t.speakers.some((s) => s.toLowerCase().includes(q));
    return videos.filter((v) => VIDEO_LANGS.some((lang) => matches(v.text[lang])));
};

export const loadVideoDetails = async (): Promise<VideoDetails> => (await import('./video-details.json')).default as VideoDetails;
