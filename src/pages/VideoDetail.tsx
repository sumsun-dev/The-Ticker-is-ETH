import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import useVideoLang from '../hooks/useVideoLang';
import SpokenLangBadge from '../components/contents/SpokenLangBadge';
import JsonLd from '../components/common/JsonLd';
import { breadcrumbLd, videoObjectLd } from '../utils/structuredData';
import { parseSpeaker } from '../utils/youtubeDescription';
import {
    findVideo,
    loadVideoDetails,
    localizeVideo,
    maxThumbUrl,
    playerUrl,
    videoPagePath,
    videoLdInput,
    watchUrl,
    type VideoDetail as VideoDetailData,
    type VideoLang,
} from '../data/videoData';

const VIDEOS_PATH = '/contents?category=Video';

const formatStamp = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="mb-3 text-lg font-bold text-theme-text">{children}</h2>
);

/**
 * 영상 세션 요약 페이지. 플레이어를 임베드하고, 챕터(?t=초)를 누르면 그 시각부터 재생한다.
 * 화면 텍스트와 페이지 메타는 사이트 언어를 따르고, JSON-LD는 정적 shell과 같은 한국어 기준으로 고정한다(단일 URL).
 */
const VideoDetail: React.FC = () => {
    const { videoId } = useParams<{ videoId: string }>();
    const { t } = useTranslation('contents');
    const [searchParams] = useSearchParams();
    const item = findVideo(videoId);
    const lang = useVideoLang();
    const video = item && localizeVideo(item, lang);
    const start = Number(searchParams.get('t')) || 0;
    // 다른 영상으로 옮겨 가도 이전 영상의 상세가 남지 않도록 id와 함께 둔다
    const [loaded, setLoaded] = useState<{ id: string; data: Record<VideoLang, VideoDetailData> } | null>(null);
    const details = loaded && loaded.id === item?.id ? loaded.data : null;
    const detail = details?.[lang] ?? null;

    usePageMeta({
        title: video?.title ?? t('video.notFound'),
        description: video?.summary,
        image: video ? maxThumbUrl(video.id) : undefined,
        type: video ? 'video.other' : 'website',
        canonical: video ? videoPagePath(video.id) : undefined,
        noindex: !video,
    });

    useEffect(() => {
        if (!item) return;
        let alive = true;
        loadVideoDetails()
            .then((all) => {
                const data = all[item.id];
                if (alive && data) setLoaded({ id: item.id, data });
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [item]);

    const ld = item && videoLdInput(item);
    const structuredData = ld && [
        videoObjectLd(ld, details?.ko),
        breadcrumbLd([
            { name: 'Home', url: '/' },
            { name: 'Contents', url: '/contents' },
            { name: ld.title, url: videoPagePath(ld.id) },
        ]),
    ];

    if (!video) {
        return (
            <div className="flex min-h-screen items-center justify-center text-theme-text">
                <div className="text-center">
                    <h1 className="mb-4 text-4xl font-bold">{t('video.notFound')}</h1>
                    <Link to={VIDEOS_PATH} className="text-brand-primary hover:underline">
                        {t('video.backToVideos')}
                    </Link>
                </div>
            </div>
        );
    }

    const speakers = video.speakers.map(parseSpeaker);

    return (
        <div className="container mx-auto min-h-screen max-w-4xl px-6 pt-28 pb-20 text-theme-text">
            {structuredData && <JsonLd data={structuredData} id="video-detail" />}
            <Link to={VIDEOS_PATH} className="mb-6 inline-flex items-center gap-1.5 text-sm text-theme-text-muted hover:text-theme-text">
                <ArrowLeft size={14} /> {t('video.backToVideos')}
            </Link>

            <div className="aspect-video overflow-hidden rounded-3xl bg-black">
                <iframe
                    key={start}
                    title={video.title}
                    src={playerUrl(video.id, start)}
                    className="h-full w-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-brand-accent">
                    Ethereum Korea One · Genesis · {t(`video.day${video.day}`)}
                </span>
                <SpokenLangBadge lang={video.spokenLang} />
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{video.title}</h1>
            <p className="mt-3 text-sm tabular-nums text-theme-text-muted">
                {video.date.replace(/-/g, '.')} · {video.duration}
            </p>
            <p className="mt-6 text-base leading-relaxed text-theme-text-secondary">{video.summary}</p>

            <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                    href={watchUrl(video.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-primary/80"
                >
                    <ExternalLink size={14} /> {t('video.watchOnYoutube')}
                </a>
                {video.day === 2 && (
                    <Link to="/events/ek1-genesis" className="inline-flex items-center rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold hover:bg-white/5">
                        {t('video.eventPage')}
                    </Link>
                )}
            </div>

            <section className="mt-12">
                <SectionTitle>{t('video.speakers')}</SectionTitle>
                <ul className="space-y-1.5 text-sm text-theme-text-secondary">
                    {speakers.map((sp, i) => (
                        <li key={`${i}-${sp.name}`}>
                            <b className="font-semibold text-theme-text">{sp.name}</b>
                            {sp.title && <span>, {sp.title}</span>}
                            {sp.moderator && <span className="ml-1.5 text-theme-text-muted">({t('video.moderator')})</span>}
                        </li>
                    ))}
                </ul>
            </section>

            {detail && (
                <>
                    <section className="mt-10">
                        <SectionTitle>{t('video.about')}</SectionTitle>
                        <p className="whitespace-pre-line leading-relaxed text-theme-text-secondary">{detail.about}</p>
                    </section>
                    <section className="mt-10">
                        <SectionTitle>{t('video.takeaways')}</SectionTitle>
                        <ul className="list-disc space-y-3 pl-5 leading-relaxed text-theme-text-secondary">
                            {detail.takeaways.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ul>
                    </section>
                    <section className="mt-10">
                        <SectionTitle>{t('video.chapters')}</SectionTitle>
                        <ol className="divide-y divide-theme-border-secondary border-y border-theme-border-secondary">
                            {detail.chapters.map((c) => (
                                <li key={c.start}>
                                    <Link
                                        to={`${videoPagePath(video.id)}?t=${c.start}`}
                                        replace
                                        className="flex gap-4 py-2.5 text-sm hover:text-brand-accent"
                                    >
                                        <span className="w-14 shrink-0 tabular-nums text-theme-text-muted">{formatStamp(c.start)}</span>
                                        <span>{c.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    </section>
                </>
            )}
        </div>
    );
};

export default VideoDetail;
