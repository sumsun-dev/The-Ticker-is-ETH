/**
 * EthereumKorea YouTube 채널의 EK1 Genesis 세션 영상 메타데이터를 받아
 * src/data/videos.json(목록)과 src/data/video-details.json(세션 소개·요약·챕터)을 갱신한다.
 *
 *   npx tsx scripts/fetch-youtube-videos.ts
 *
 * 기존 항목의 순서·day·sessionId는 유지하고, 새 영상은 끝에 붙인다(sessionId는 직접 채운다).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYoutubeDescription } from '../src/utils/youtubeDescription';
import { VIDEO_ID_RE, type VideoDetail, type VideoItem } from '../src/data/videoData';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEOS_PATH = join(ROOT, 'src/data/videos.json');
const DETAILS_PATH = join(ROOT, 'src/data/video-details.json');
const CHANNEL_URL = 'https://www.youtube.com/@EthereumKorea/videos';
const SERIES_SUFFIX = ' | 이더리움 코리아 원 : 제네시스';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const TIMEOUT_MS = 30_000;

/** ytInitialData 안의 영상 카드 (필요한 필드만) */
interface LockupViewModel {
    contentId?: string;
    metadata?: { lockupMetadataViewModel?: { title?: { content?: string } } };
    contentImage?: unknown;
}

async function getHtml(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, 'accept-language': 'ko-KR' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return res.text();
}

/** 채널 영상 탭 첫 페이지의 영상 ID와 제목 (Genesis는 30개라 첫 페이지에 다 들어온다) */
async function listChannelVideos(): Promise<Array<{ id: string; title: string; duration: string }>> {
    const html = await getHtml(CHANNEL_URL);
    const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
    if (!m) throw new Error('ytInitialData not found');
    const out: Array<{ id: string; title: string; duration: string }> = [];
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== 'object') return;
        const obj = node as Record<string, unknown>;
        const lockup = obj.lockupViewModel as LockupViewModel | undefined;
        if (lockup?.contentId) {
            const title = lockup.metadata?.lockupMetadataViewModel?.title?.content ?? '';
            const duration = /"text":"(\d+:\d+(?::\d+)?)"/.exec(JSON.stringify(lockup.contentImage ?? {}))?.[1] ?? '';
            out.push({ id: lockup.contentId, title, duration });
        }
        Object.values(obj).forEach(walk);
    };
    walk(JSON.parse(m[1]));
    return out.filter((v) => VIDEO_ID_RE.test(v.id) && v.title.endsWith(SERIES_SUFFIX));
}

async function fetchWatchMeta(id: string) {
    if (!VIDEO_ID_RE.test(id)) throw new Error(`invalid video id: ${id}`);
    const html = await getHtml(`https://www.youtube.com/watch?v=${id}`);
    const uploadDate = /"uploadDate":"([^"]+)"/.exec(html)?.[1];
    const seconds = Number(/"lengthSeconds":"(\d+)"/.exec(html)?.[1] ?? 0);
    const rawDesc = /"shortDescription":"((?:[^"\\]|\\.)*)"/.exec(html)?.[1];
    if (!uploadDate || !seconds || rawDesc === undefined) throw new Error(`metadata missing for ${id}`);
    return { uploadDate, seconds, description: JSON.parse(`"${rawDesc}"`) as string };
}

/** 설명 끝의 행사 표기 "Ethereum Korea One: Genesis Day 2 | 2026.09.29 | …" 로 Day와 날짜를 정한다 */
function eventDay(description: string): Pick<VideoItem, 'day' | 'date'> {
    const footer = /Genesis(?: Day (\d))? \| (\d{4})\.(\d{2})\.(\d{2})/.exec(description);
    if (!footer) throw new Error('event footer not found');
    return { day: footer[1] === '2' ? 2 : 1, date: `${footer[2]}-${footer[3]}-${footer[4]}` };
}

async function main() {
    const existing = JSON.parse(readFileSync(VIDEOS_PATH, 'utf8')) as VideoItem[];
    const known = new Map(existing.map((v) => [v.id, v]));
    const channel = await listChannelVideos();
    const order = [...existing.map((v) => v.id), ...channel.map((v) => v.id).filter((id) => !known.has(id))];
    const channelById = new Map(channel.map((v) => [v.id, v]));

    const videos: VideoItem[] = [];
    const details: Record<string, VideoDetail> = {};
    for (const id of order) {
        const listed = channelById.get(id);
        const prev = known.get(id);
        if (!listed && !prev) continue;
        const meta = await fetchWatchMeta(id);
        const parsed = parseYoutubeDescription(meta.description);
        videos.push({
            id,
            title: listed ? listed.title.slice(0, -SERIES_SUFFIX.length) : prev!.title,
            event: 'ek1-genesis',
            ...eventDay(meta.description),
            duration: listed?.duration || prev!.duration,
            ...(prev?.sessionId ? { sessionId: prev.sessionId } : {}),
            uploadDate: meta.uploadDate,
            seconds: meta.seconds,
            summary: parsed.lead,
            speakers: parsed.speakers,
            lang: parsed.lang,
        });
        details[id] = { about: parsed.about, takeaways: parsed.takeaways, chapters: parsed.chapters };
    }

    writeFileSync(VIDEOS_PATH, JSON.stringify(videos, null, 2) + '\n');
    writeFileSync(DETAILS_PATH, JSON.stringify(details, null, 2) + '\n');
    const added = videos.filter((v) => !known.has(v.id)).map((v) => v.id);
    console.log(`[fetch-youtube-videos] ${videos.length} videos${added.length ? ` · new: ${added.join(', ')} (sessionId 확인 필요)` : ''}`);
}

main().catch((err) => {
    console.error('[fetch-youtube-videos]', err);
    process.exit(1);
});
