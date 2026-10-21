import React from 'react';
import { Play } from 'lucide-react';
import { thumbUrl, type VideoItem } from '../../data/videoData';

interface VideoCardProps {
    video: VideoItem;
    onPlay: (video: VideoItem) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onPlay }) => (
    <button
        type="button"
        onClick={() => onPlay(video)}
        className="group flex flex-col overflow-hidden rounded-3xl border border-theme-border bg-theme-surface text-left transition-all duration-300 hover:border-brand-primary/50"
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
        <h3 className="line-clamp-2 p-5 text-base font-semibold leading-snug text-theme-text transition-colors group-hover:text-brand-accent">
            {video.title}
        </h3>
    </button>
);

export default VideoCard;
