import { motion } from 'framer-motion';
import type { TeamMember } from '../../types/team';
import ContributionGraph from './ContributionGraph';
import { Github, Twitter, Send, Linkedin, Globe } from 'lucide-react';

const EthIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className }) => (
    <svg width={size} height={size} viewBox="0 0 256 417" className={className} fill="none">
        <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fill="#828384" />
        <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fill="#8C8C8C" />
        <path d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.601L256 236.587z" fill="#646464" />
        <path d="M127.962 416.905v-104.72L0 236.585z" fill="#8C8C8C" />
        <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fill="#393939" />
        <path d="M0 212.32l127.96 75.638v-133.8z" fill="#545454" />
    </svg>
);
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAvatarFallbackUrl, getTotalContributions } from '../../utils/members';

interface MemberCardProps {
    member: TeamMember;
}

const MemberCard: React.FC<MemberCardProps> = ({ member }) => {
    const { t } = useTranslation();
    const bioKey = `team:bios.${member.name.toLowerCase()}`;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-theme-border rounded-2xl p-6 hover:border-brand-accent/30 transition-all group hover:bg-white/[0.07]"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <img
                            src={member.avatarUrl || getAvatarFallbackUrl(member.name)}
                            alt={member.name}
                            loading="lazy"
                            decoding="async"
                            width={64}
                            height={64}
                            className="w-16 h-16 rounded-full object-cover border-2 border-transparent group-hover:border-brand-accent transition-colors"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = getAvatarFallbackUrl(member.name);
                            }}
                        />
                        {member.isCurrent && (
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-theme-bg rounded-full" title="Active Object" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-theme-text group-hover:text-brand-accent transition-colors">
                            {member.name}
                        </h3>
                        <p className="text-sm text-brand-primary font-medium">{member.role}</p>
                        <p className="text-xs text-theme-text-muted mt-1">{member.period}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {member.social.github && (
                        <a href={member.social.github} target="_blank" rel="noopener noreferrer" className="text-theme-text-secondary hover:text-theme-text transition-colors">
                            <Github size={18} />
                        </a>
                    )}
                    {member.social.twitter && (
                        <a href={member.social.twitter} target="_blank" rel="noopener noreferrer" className="text-theme-text-secondary hover:text-theme-text transition-colors">
                            <Twitter size={18} />
                        </a>
                    )}
                    {member.social.telegram && (
                        <a href={member.social.telegram} target="_blank" rel="noopener noreferrer" className="text-theme-text-secondary hover:text-social-telegram transition-colors">
                            <Send size={18} />
                        </a>
                    )}
                    {member.social.linkedin && (
                        <a href={member.social.linkedin} target="_blank" rel="noopener noreferrer" className="text-theme-text-secondary hover:text-theme-text transition-colors">
                            <Linkedin size={18} />
                        </a>
                    )}
                    {member.social.website && (
                        <a href={member.social.website} target="_blank" rel="noopener noreferrer" className="text-theme-text-secondary hover:text-theme-text transition-colors">
                            <Globe size={18} />
                        </a>
                    )}
                </div>
            </div>

            <p className="text-theme-text-secondary text-sm mb-4 line-clamp-2">
                {t(bioKey, { defaultValue: member.bio })}
            </p>

            {member.highlights && member.highlights.length > 0 && (
                <div className="mb-4 space-y-1">
                    {member.highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <EthIcon size={12} className="flex-shrink-0 opacity-80" />
                            {h.url ? (
                                <a
                                    href={h.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-theme-text-secondary hover:text-theme-text transition-colors truncate"
                                >
                                    {h.title}
                                </a>
                            ) : (
                                <span className="text-xs text-theme-text-secondary truncate">{h.title}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">{t('recentActivity')}</span>
                    <span className="text-xs text-brand-accent">
                        {getTotalContributions(member.contributions)} {t('contributions')}
                    </span>
                </div>
                <ContributionGraph data={member.contributions} />
            </div>

            <Link
                to={member.memberType === 'core' ? `/team/${member.id}` : `/contributors/${member.id}`}
                className="block w-full text-center py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-theme-text transition-colors border border-transparent hover:border-theme-border"
            >
                {t('viewProfile')}
            </Link>
        </motion.div>
    );
};

export default MemberCard;
