import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { thumbUrl, videoPagePath, watchUrl, type VideoItem } from '../../data/videoData';
import { parseSpeaker } from '../../utils/youtubeDescription';

interface VideoCardProps {
    video: VideoItem;
}

/** 썸네일·제목은 YouTube로 바로 보내고, 아래 링크는 사이트의 세션 요약 페이지로 보낸다 */
const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
    const { t } = useTranslation('contents');
    const names = video.speakers.map((s) => parseSpeaker(s).name).join(' · ');

    return (
        <article className="group flex flex-col overflow-hidden rounded-3xl border border-theme-border bg-theme-surface transition-all duration-300 hover:border-brand-primary/50">
            <a
                href={watchUrl(video.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                    <img
                        src={thumbUrl(video.id)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-80 transition-opacity group-hover:opacity-100">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                            <Play size={20} className="ml-0.5" aria-hidden="true" />
                        </span>
                    </span>
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs tabular-nums text-white">{video.duration}</span>
                </div>
                <h3 className="line-clamp-2 px-5 pt-5 text-base font-semibold leading-snug text-theme-text transition-colors group-hover:text-brand-accent">
                    {video.title}
                    <span className="sr-only">{` (${t('video.opensYoutube')})`}</span>
                </h3>
            </a>
            <div className="mt-auto flex flex-col gap-3 px-5 pb-5 pt-2">
                <p className="line-clamp-1 text-[13px] text-theme-text-muted">{names}</p>
                <Link
                    to={videoPagePath(video.id)}
                    aria-label={`${video.title} ${t('video.summaryLink')}`}
                    className="inline-flex items-center gap-1 self-start rounded text-[13px] font-semibold text-brand-primary hover:text-theme-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                    {t('video.summaryLink')} <ArrowRight size={13} aria-hidden="true" />
                </Link>
            </div>
        </article>
    );
};

export default VideoCard;
