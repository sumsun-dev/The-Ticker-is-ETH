import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, Twitter, MessageCircle, PenTool, ArrowLeft, Eye, Share2, ExternalLink, Linkedin, Send, Globe } from 'lucide-react';

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
import { useTranslation } from 'react-i18next';
import ContributionGraph from '../components/team/ContributionGraph';
import { mockMembers, mockContributors } from '../data/mockData';
import { getAvatarFallbackUrl, getTotalContributions } from '../utils/members';
import usePageMeta from '../hooks/usePageMeta';
import JsonLd from '../components/common/JsonLd';
import { personLd, breadcrumbLd } from '../utils/structuredData';

function extractDomain(url: string): string {
    try {
        const host = new URL(url).hostname.replace('www.', '');
        return host.length > 24 ? host.slice(0, 21) + '...' : host;
    } catch {
        return '';
    }
}

const MemberDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const [now] = React.useState(() => Date.now());

    const member = [...mockMembers, ...mockContributors].find(m => m.id === id);

    const memberBase = member?.memberType === 'core' ? '/team' : '/contributors';
    usePageMeta({
        title: member?.name ?? 'Member',
        description: member
            ? `${member.role} · ${member.bio ?? ''}`.trim().slice(0, 200)
            : undefined,
        image: member?.avatarUrl || undefined,
        canonical: member ? `${memberBase}/${member.id}` : undefined,
        type: 'profile',
        noindex: !member,
    });

    const structuredData = React.useMemo(
        () =>
            member
                ? [
                      personLd(member),
                      breadcrumbLd([
                          { name: 'Home', url: '/' },
                          {
                              name: member.memberType === 'core' ? 'Core Team' : 'Contributors',
                              url: memberBase,
                          },
                          { name: member.name, url: `${memberBase}/${member.id}` },
                      ]),
                  ]
                : null,
        [member, memberBase],
    );

    if (!member) {
        return (
            <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
                <Link to="/team" className="inline-flex items-center text-theme-text-muted hover:text-theme-text mb-8 transition-colors">
                    <ArrowLeft size={20} className="mr-2" /> {t('backToTeam')}
                </Link>
                <div className="text-center text-xl font-light">{t('memberNotFound')}</div>
            </div>
        );
    }

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'telegram': return <MessageCircle size={16} className="text-blue-400" />;
            case 'github': return <Github size={16} className="text-theme-text-secondary" />;
            case 'blog': return <PenTool size={16} className="text-brand-accent" />;
            default: return <MessageCircle size={16} />;
        }
    };

    const backLink = member.memberType === 'core' ? '/team' : '/contributors';
    const backLabel = member.memberType === 'core' ? t('backToTeam') : t('backToContributors');
    const totalMessages = member.recentActivity.length;
    const bioKey = `team:bios.${member.name.toLowerCase()}`;

    const DAY_MS = 24 * 60 * 60 * 1000;
    const last14 = member.contributions
        .filter(c => now - new Date(c.date).getTime() <= 14 * DAY_MS)
        .reduce((a, c) => a + c.count, 0);
    const last30 = member.contributions
        .filter(c => now - new Date(c.date).getTime() <= 30 * DAY_MS)
        .reduce((a, c) => a + c.count, 0);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto">
            {structuredData && <JsonLd data={structuredData} id="member-detail" />}
            <Link to={backLink} className="inline-flex items-center text-theme-text-muted hover:text-theme-text mb-8 transition-colors group">
                <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" /> {backLabel}
            </Link>

            <div className="grid lg:grid-cols-3 gap-12">
                {/* Profile Sidebar */}
                <div className="lg:col-span-1">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-theme-surface border border-theme-border rounded-3xl p-8 sticky top-28 backdrop-blur-md"
                    >
                        <div className="relative w-32 h-32 mx-auto mb-6">
                            <img
                                src={member.avatarUrl || getAvatarFallbackUrl(member.name, 128)}
                                alt={member.name}
                                width={128}
                                height={128}
                                decoding="async"
                                className="w-full h-full rounded-full object-cover border-4 border-theme-bg shadow-2xl"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = getAvatarFallbackUrl(member.name, 128);
                                }}
                            />
                            {member.isCurrent && (
                                <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-theme-bg rounded-full" />
                            )}
                        </div>

                        <h1 className="text-3xl font-bold text-center text-theme-text mb-2">{member.name}</h1>
                        <p className="text-center text-brand-primary font-semibold mb-6 uppercase tracking-wider text-xs">{member.role}</p>

                        <div className="flex justify-center gap-3 mb-8">
                            {member.social.twitter && (
                                <a href={member.social.twitter} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover transition-all" title="Twitter">
                                    <Twitter size={20} />
                                </a>
                            )}
                            {member.social.github && (
                                <a href={member.social.github} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover transition-all" title="GitHub">
                                    <Github size={20} />
                                </a>
                            )}
                            {member.social.linkedin && (
                                <a href={member.social.linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover transition-all" title="LinkedIn">
                                    <Linkedin size={20} />
                                </a>
                            )}
                            {member.social.telegram && (
                                <a href={member.social.telegram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover transition-all" title="Telegram">
                                    <Send size={20} />
                                </a>
                            )}
                            {member.social.website && (
                                <a href={member.social.website} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover transition-all" title="Website">
                                    <Globe size={20} />
                                </a>
                            )}
                        </div>

                        <div className="space-y-4 text-sm text-theme-text-muted mb-8 border-t border-theme-border-secondary pt-8">
                            <div className="flex justify-between">
                                <span>{t('membership')}</span>
                                <span className={member.isCurrent ? "text-green-400 font-medium" : "text-theme-text-muted"}>
                                    {member.isCurrent ? (member.memberType === 'core' ? t('activeCore') : t('activeContributor')) : t('alumni')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('contributionPeriod')}</span>
                                <span className="text-theme-text">{member.period}</span>
                            </div>
                        </div>

                        <div className="bg-theme-surface rounded-2xl p-4 mb-8">
                            <p className="text-theme-text-secondary text-sm leading-relaxed italic">
                                "{t(bioKey, { defaultValue: member.bio })}"
                            </p>
                        </div>

                        {/* Highlight Contributions */}
                        {member.highlights && member.highlights.length > 0 && (
                            <div className="mb-8 border-t border-theme-border-secondary pt-6">
                                <h4 className="text-xs font-semibold text-theme-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <EthIcon size={12} className="opacity-80" />
                                    {t('highlights')}
                                </h4>
                                <div className="space-y-2">
                                    {member.highlights.map((h, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <EthIcon size={14} className="mt-0.5 flex-shrink-0 opacity-70" />
                                            {h.url ? (
                                                <a
                                                    href={h.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-theme-text-secondary hover:text-theme-text transition-colors leading-snug"
                                                >
                                                    {h.title}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-theme-text-secondary leading-snug">{h.title}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Contribution Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-theme-surface rounded-xl p-3 text-center">
                                <div className="text-xl font-bold text-theme-text">{totalMessages}</div>
                                <div className="text-[10px] text-theme-text-muted mt-1">{t('total')}</div>
                            </div>
                            <div className="bg-theme-surface rounded-xl p-3 text-center">
                                <div className="text-xl font-bold text-brand-accent">{last30}</div>
                                <div className="text-[10px] text-theme-text-muted mt-1">{t('last30d')}</div>
                            </div>
                            <div className="bg-theme-surface rounded-xl p-3 text-center">
                                <div className="text-xl font-bold text-brand-primary">{last14}</div>
                                <div className="text-[10px] text-theme-text-muted mt-1">{t('last14d')}</div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-12">
                    {/* Contribution Graph */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-brand-dark/30 border border-theme-border rounded-3xl p-8 backdrop-blur-sm"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-theme-text">
                                {t('contributionPulse')}
                            </h3>
                            <span className="text-xs font-semibold text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full uppercase tracking-widest">
                                {t('totalMessages', { count: totalMessages })}
                            </span>
                        </div>
                        <ContributionGraph data={member.contributions} />
                    </motion.div>

                    {/* Activity Log */}
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-theme-text">{t('recentContributions')}</h3>
                            <span className="text-xs text-theme-text-muted">
                                {t('messagesInWeeks', { count: getTotalContributions(member.contributions), weeks: Math.ceil(member.contributions.length / 7) })}
                            </span>
                        </div>
                        <div className="max-h-[640px] overflow-y-auto pr-1 space-y-3">
                            {member.recentActivity.map((activity) => {
                                const domain = activity.sourceUrl ? extractDomain(activity.sourceUrl) : '';

                                return (
                                    <motion.div
                                        key={activity.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="group relative pl-8 border-l border-theme-border pb-6 last:pb-0 last:border-0"
                                    >
                                        {/* Timeline dot */}
                                        <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-theme-bg border border-white/20 flex items-center justify-center">
                                            {getActivityIcon(activity.type)}
                                        </div>

                                        {/* Content card */}
                                        <div className="bg-white/[0.02] group-hover:bg-white/[0.05] border border-transparent group-hover:border-theme-border-secondary rounded-xl p-4 transition-all duration-200">
                                            {/* Date + meta row */}
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-[11px] text-theme-text-muted font-medium">{activity.date}</span>
                                                {activity.views != null && activity.views > 0 && (
                                                    <span className="flex items-center gap-1 text-[10px] text-theme-text-muted">
                                                        <Eye size={10} /> {activity.views.toLocaleString()}
                                                    </span>
                                                )}
                                                {activity.forwards != null && activity.forwards > 0 && (
                                                    <span className="flex items-center gap-1 text-[10px] text-theme-text-muted">
                                                        <Share2 size={10} /> {activity.forwards}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Content text */}
                                            <p className="text-sm text-theme-text-secondary leading-relaxed mb-2">
                                                {activity.content}
                                            </p>

                                            {/* Footer: source URL tag + telegram link */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {domain && (
                                                    <a
                                                        href={activity.sourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-theme-text-secondary hover:text-theme-text hover:bg-white/10 transition-colors"
                                                    >
                                                        <ExternalLink size={9} />
                                                        {domain}
                                                    </a>
                                                )}
                                                {activity.link && (
                                                    <a
                                                        href={activity.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[11px] text-brand-accent/70 hover:text-brand-accent transition-colors"
                                                    >
                                                        {t('viewOnTelegram')} &rarr;
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberDetail;
