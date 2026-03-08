import React from 'react';

interface SkeletonProps {
    className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
    <div className={`animate-pulse bg-theme-surface rounded-lg ${className}`} />
);

export const CardSkeleton: React.FC = () => (
    <div className="bg-theme-surface border border-theme-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
            </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-20 w-full rounded-xl" />
    </div>
);

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
            </div>
        ))}
    </div>
);

export const PageSkeleton: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-3xl px-6 space-y-6">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                {Array.from({ length: 6 }, (_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
        </div>
    </div>
);

export default Skeleton;
