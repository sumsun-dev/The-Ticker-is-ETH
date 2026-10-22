/**
 * EthereumKorea YouTube 채널의 EK1 Genesis 세션 영상 메타데이터를 받아
 * src/data/videos.json(목록)과 src/data/video-details.json(세션 소개·요약·챕터)을 갱신한다.
 *
 *   npx tsx scripts/fetch-youtube-videos.ts
 *
 * 채널은 영상마다 한국어·영어 제목과 설명을 모두 등록해 두었다. watch 페이지를 hl=ko, hl=en으로
 * 각각 받아 두 언어 버전을 저장한다. 영상 원문(진행 언어)은 기본 설명란의 언어로 정한다.
 *
 * 기존 항목의 순서·sessionId는 유지하고, 새 영상은 끝에 붙인다(sessionId는 직접 채운다).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSeriesTitle, parseYoutubeDescription, stripSeriesSuffix } from '../src/utils/youtubeDescription';
import { VIDEO_ID_RE, VIDEO_LANGS, type VideoDetail, type VideoDetails, type VideoItem, type VideoLang, type VideoText } from '../src/data/videoData';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEOS_PATH = join(ROOT, 'src/data/videos.json');
const DETAILS_PATH = join(ROOT, 'src/data/video-details.json');
const CHANNEL_URL = 'https://www.youtube.com/@EthereumKorea/videos';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const ACCEPT_LANGUAGE: Record<VideoLang, string> = { ko: 'ko-KR', en: 'en-US' };
const TIMEOUT_MS = 30_000;
const RETRIES = 2;
const RETRY_DELAY_MS = 3_000;
const REQUEST_GAP_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** ytInitialData 안의 영상 카드 (필요한 필드만) */
interface LockupViewModel {
    contentId?: string;
    metadata?: { lockupMetadataViewModel?: { title?: { content?: string } } };
    contentImage?: unknown;
}

interface WatchPage {
    uploadDate: string;
    seconds: number;
    /** 기본(원문) 설명란 */
    defaultDescription: string;
    /** 요청한 언어로 현지화된 제목·설명란 */
    title: string;
    description: string;
}

async function getHtml(url: string, lang: VideoLang): Promise<string> {
    const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, 'accept-language': ACCEPT_LANGUAGE[lang] },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return res.text();
}

/** HTML 안의 JSON 문자열 값 하나 */
const jsonString = (html: string, re: RegExp): string | undefined => {
    const raw = re.exec(html)?.[1];
    return raw === undefined ? undefined : (JSON.parse(`"${raw}"`) as string);
};

/** 채널 영상 탭 첫 페이지의 영상 ID와 길이 (Genesis는 30개라 첫 페이지에 다 들어온다) */
async function listChannelVideos(): Promise<Array<{ id: string; duration: string }>> {
    const html = await getHtml(CHANNEL_URL, 'ko');
    const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
    if (!m) throw new Error('ytInitialData not found');
    const out: Array<{ id: string; duration: string }> = [];
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== 'object') return;
        const obj = node as Record<string, unknown>;
        const lockup = obj.lockupViewModel as LockupViewModel | undefined;
        const title = lockup?.metadata?.lockupMetadataViewModel?.title?.content ?? '';
        if (lockup?.contentId && VIDEO_ID_RE.test(lockup.contentId) && isSeriesTitle(title)) {
            const duration = /"text":"(\d+:\d+(?::\d+)?)"/.exec(JSON.stringify(lockup.contentImage ?? {}))?.[1] ?? '';
            out.push({ id: lockup.contentId, duration });
        }
        Object.values(obj).forEach(walk);
    };
    walk(JSON.parse(m[1]));
    return out;
}

async function fetchWatchPage(id: string, lang: VideoLang): Promise<WatchPage> {
    if (!VIDEO_ID_RE.test(id)) throw new Error(`invalid video id: ${id}`);
    const html = await getHtml(`https://www.youtube.com/watch?v=${id}&hl=${lang}`, lang);
    const uploadDate = /"uploadDate":"([^"]+)"/.exec(html)?.[1];
    const seconds = Number(/"lengthSeconds":"(\d+)"/.exec(html)?.[1] ?? 0);
    const defaultDescription = jsonString(html, /"shortDescription":"((?:[^"\\]|\\.)*)"/);
    // 현지화된 값은 화면 렌더러(videoPrimaryInfo / attributedDescription)에만 들어 있다.
    // 시리즈 제목은 링크·해시태그 없는 한 덩어리라 첫 run만 읽는다(아래 isSeriesTitle로 형태를 다시 확인한다)
    const title = jsonString(html, /"videoPrimaryInfoRenderer":\{"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
    const description = jsonString(html, /"attributedDescription":\{"content":"((?:[^"\\]|\\.)*)"/);
    if (!uploadDate || !seconds || defaultDescription === undefined || !title || !description) {
        throw new Error(`metadata missing for ${id} (hl=${lang})`);
    }
    if (!isSeriesTitle(title)) throw new Error(`unexpected title for ${id} (hl=${lang}): ${title}`);
    return { uploadDate, seconds, defaultDescription, title, description };
}

/** 설명 끝의 행사 표기 "Ethereum Korea One: Genesis Day 2 | 2026.09.29 | …" 로 Day와 날짜를 정한다 */
function eventDay(description: string): Pick<VideoItem, 'day' | 'date'> {
    const footer = /Genesis(?: Day (\d))? \| (\d{4})\.(\d{2})\.(\d{2})/.exec(description);
    if (!footer) throw new Error('event footer not found');
    return { day: footer[1] === '2' ? 2 : 1, date: `${footer[2]}-${footer[3]}-${footer[4]}` };
}

async function fetchVideo(id: string, duration: string, sessionId: string | undefined) {
    const pages = {} as Record<VideoLang, WatchPage>;
    for (const lang of VIDEO_LANGS) {
        pages[lang] = await fetchWatchPage(id, lang);
        await sleep(REQUEST_GAP_MS);
    }

    const text = {} as Record<VideoLang, VideoText>;
    const detail = {} as Record<VideoLang, VideoDetail>;
    for (const lang of VIDEO_LANGS) {
        const parsed = parseYoutubeDescription(pages[lang].description);
        if (parsed.lang !== lang) throw new Error(`${id}: hl=${lang} returned a ${parsed.lang} description`);
        text[lang] = { title: stripSeriesSuffix(pages[lang].title), summary: parsed.lead, speakers: parsed.speakers };
        detail[lang] = { about: parsed.about, takeaways: parsed.takeaways, chapters: parsed.chapters };
    }

    const { uploadDate, seconds, defaultDescription } = pages.ko;
    const video: VideoItem = {
        id,
        event: 'ek1-genesis',
        ...eventDay(defaultDescription),
        duration,
        ...(sessionId ? { sessionId } : {}),
        uploadDate,
        seconds,
        spokenLang: parseYoutubeDescription(defaultDescription).lang,
        text,
    };
    return { video, detail };
}

/** 일시적 실패(429 등)는 몇 번 더 시도한다 */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt >= RETRIES) throw err;
            console.warn(`[fetch-youtube-videos] ${label} 재시도 ${attempt + 1}/${RETRIES}: ${(err as Error).message}`);
            await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
    }
}

async function main() {
    const existing = JSON.parse(readFileSync(VIDEOS_PATH, 'utf8')) as Array<Pick<VideoItem, 'id' | 'duration' | 'sessionId'>>;
    const known = new Map(existing.map((v) => [v.id, v]));
    const channel = await listChannelVideos();
    const channelById = new Map(channel.map((v) => [v.id, v]));
    const order = [...existing.map((v) => v.id), ...channel.map((v) => v.id).filter((id) => !known.has(id))];

    const videos: VideoItem[] = [];
    const details: VideoDetails = {};
    for (const id of order) {
        const listed = channelById.get(id);
        const prev = known.get(id);
        if (!listed && !prev) continue;
        const { video, detail } = await withRetry(id, () => fetchVideo(id, listed?.duration || prev!.duration, prev?.sessionId));
        videos.push(video);
        details[id] = detail;
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
