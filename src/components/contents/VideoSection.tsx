import React, { useCallback, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VideoCard from './VideoCard';
import VideoPlayerModal from './VideoPlayerModal';
import { VIDEO_CHANNEL_URL, VIDEO_DAYS, videosByDay, type VideoItem } from '../../data/videoData';

interface VideoSectionProps {
    videos: VideoItem[];
}

/** Contents의 영상 탭. EK1 Genesis 세션 영상을 Day별로 묶어 보여준다 */
const VideoSection: React.FC<VideoSectionProps> = ({ videos }) => {
    const { t } = useTranslation('contents');
    const [playing, setPlaying] = useState<VideoItem | null>(null);
    const closePlayer = useCallback(() => setPlaying(null), []);

    return (
        <div className="space-y-14">
            {VIDEO_DAYS.map((day) => {
                const list = videosByDay(day, videos);
                if (list.length === 0) return null;
                const headingId = `videos-day${day}`;
                return (
                    <section key={day} aria-labelledby={headingId}>
                        <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                            <h2 id={headingId} className="text-2xl font-bold text-theme-text">
                                {t(`video.day${day}`)}
                            </h2>
                            <span className="text-sm text-theme-text-muted">{t(`video.day${day}Meta`, { count: list.length })}</span>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {list.map((v) => (
                                <VideoCard key={v.id} video={v} onPlay={setPlaying} />
                            ))}
                        </div>
                    </section>
                );
            })}

            <a
                href={VIDEO_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold text-theme-text hover:bg-white/5"
            >
                <ExternalLink size={14} /> {t('video.channel')}
            </a>

            {playing && <VideoPlayerModal video={playing} onClose={closePlayer} />}
        </div>
    );
};

export default VideoSection;
