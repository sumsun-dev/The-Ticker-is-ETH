/**
 * 영상 콘텐츠. 지금은 EthereumKorea YouTube 채널에 올라온 EK1 Genesis 세션 영상이다.
 * 순서는 행사 진행 순이고, Day 2 영상은 sessionId로 ek1-genesis.json 세션과 이어진다.
 */
import data from './videos.json';

export type VideoDay = 1 | 2;

export interface VideoItem {
    /** YouTube 영상 ID */
    id: string;
    title: string;
    event: string;
    day: VideoDay;
    date: string;
    duration: string;
    sessionId?: string;
}

export const VIDEOS = data as VideoItem[];
export const VIDEO_CHANNEL_URL = 'https://www.youtube.com/@EthereumKorea/videos';
export const VIDEO_DAYS: readonly VideoDay[] = [1, 2];

export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

export const videosByDay = (day: VideoDay, videos: VideoItem[] = VIDEOS) => videos.filter((v) => v.day === day);

export const filterVideos = (videos: VideoItem[], query: string) => {
    const q = query.trim().toLowerCase();
    return q ? videos.filter((v) => v.title.toLowerCase().includes(q)) : videos;
};
