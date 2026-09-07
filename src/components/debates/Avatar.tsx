import React, { useState } from 'react';
import type { DebateHolder } from '../../data/ethDebatesData';
import { avatarColorOf, initialsOf } from '../../utils/debates';

interface AvatarProps {
    holder: Pick<DebateHolder, 'name' | 'handle' | 'avatar' | 'role'>;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };

/** X 프로필 사진. 링크가 죽으면(프로필 사진 교체 등) 이니셜 원으로 떨어진다. */
const Avatar: React.FC<AvatarProps> = ({ holder, size = 'md', className = '' }) => {
    const [broken, setBroken] = useState(false);
    const label = [holder.handle ? `@${holder.handle}` : holder.name, holder.role].filter(Boolean).join(' · ');
    const base = `${SIZE[size]} rounded-full flex-none ${className}`;

    if (holder.avatar && !broken) {
        return (
            <img
                src={holder.avatar}
                alt={label}
                title={label}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setBroken(true)}
                className={`${base} object-cover bg-theme-surface`}
            />
        );
    }
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={`${base} inline-flex items-center justify-center font-bold text-white ${avatarColorOf(holder.handle ?? holder.name)}`}
        >
            {initialsOf(holder)}
        </span>
    );
};

export default Avatar;
