import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { ChevronDown, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EthCursorTrail from '../components/cursor/EthCursorTrail';
import LanguageToggle from '../components/common/LanguageToggle';
import { prefetchRoute } from '../routes/prefetch';

// import AuthButton from '../components/common/AuthButton'; // temporarily disabled

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t } = useTranslation();
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const desktopNavRef = useRef<HTMLDivElement>(null);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const { pathname } = useLocation();

    // 다른 페이지로 가면(뒤로 가기 포함) 펼친 메뉴를 닫는다. 렌더 중 상태 조정 패턴
    const [navPath, setNavPath] = useState(pathname);
    if (navPath !== pathname) {
        setNavPath(pathname);
        setOpenGroup(null);
        setIsMobileMenuOpen(false);
    }

    // 펼친 메뉴 바깥을 누르면 닫는다
    useEffect(() => {
        if (!openGroup) return;
        const onDown = (e: MouseEvent) => {
            if (!desktopNavRef.current?.contains(e.target as Node)) setOpenGroup(null);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [openGroup]);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            const scrolled = window.scrollY > 50;
            setIsScrolled(prev => prev === scrolled ? prev : scrolled);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ESC key closes mobile menu; focus trap
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && openGroup) {
            setOpenGroup(null);
            return;
        }
        if (e.key === 'Escape' && isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
            menuButtonRef.current?.focus();
            return;
        }
        if (e.key === 'Tab' && isMobileMenuOpen && mobileMenuRef.current) {
            const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(
                'a, button, input, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, [isMobileMenuOpen, openGroup]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Focus first link when mobile menu opens
    useEffect(() => {
        if (isMobileMenuOpen && mobileMenuRef.current) {
            const firstLink = mobileMenuRef.current.querySelector<HTMLElement>('a, button');
            firstLink?.focus();
        }
    }, [isMobileMenuOpen]);

    const item = (key: string, path: string) => ({ key, path, name: t(`nav.${key}`), desc: t(`nav.desc.${key}`) });
    const navGroups = [
        { key: 'news', items: [item('news', '/news'), item('debates', '/debates'), item('contents', '/contents')] },
        { key: 'protocol', items: [item('roadmap', '/roadmap'), item('forks', '/forks'), item('calls', '/calls'), item('eips', '/eips'), item('ercs', '/ercs'), item('mandate', '/ef-mandate')] },
        { key: 'community', items: [item('events', '/events'), item('ecosystem', '/ecosystem'), item('team', '/team'), item('about', '/about')] },
    ];
    const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

    return (
        <div className="min-h-screen flex flex-col overflow-x-hidden bg-theme-bg text-theme-text">
            {/* Skip Navigation */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-theme-text focus:rounded-lg focus:outline-none"
            >
                {t('nav.skipToContent')}
            </a>

            <EthCursorTrail />
            <nav
                aria-label="Main navigation"
                className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'backdrop-blur-md py-4 bg-primary-80 border-b border-theme-border-secondary' : 'bg-transparent py-6'
                    }`}
            >
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2.5" aria-label="Ethereum Collective Korea Home">
                        <img
                            src="/assets/eck-lockup-on-dark.svg"
                            alt=""
                            role="presentation"
                            className="h-7 md:h-8 w-auto"
                        />
                        <span className="text-theme-text-secondary font-medium text-[10px] sm:text-xs md:text-sm">
                            Ethereum Collective Korea
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex gap-8 items-center">
                        <div ref={desktopNavRef} className="flex gap-2 items-center">
                            {navGroups.map((g) => {
                                const open = openGroup === g.key;
                                const active = g.items.some((i) => isActive(i.path));
                                return (
                                    <div key={g.key} className="relative">
                                        <button
                                            type="button"
                                            aria-expanded={open}
                                            aria-controls={`nav-${g.key}`}
                                            onClick={() => setOpenGroup(open ? null : g.key)}
                                            className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${open || active ? 'text-theme-text' : 'text-theme-text-secondary hover:text-theme-text'} ${open ? 'bg-theme-surface' : ''}`}
                                        >
                                            {t(`nav.groups.${g.key}`)}
                                            <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                                        </button>
                                        {open && (
                                            <div id={`nav-${g.key}`} className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[460px] grid grid-cols-2 gap-1 p-2 rounded-2xl border border-theme-border-secondary bg-theme-bg-secondary shadow-2xl">
                                                {g.items.map((i) => (
                                                    <Link
                                                        key={i.path}
                                                        to={i.path}
                                                        aria-current={isActive(i.path) ? 'page' : undefined}
                                                        onClick={() => setOpenGroup(null)}
                                                        onPointerEnter={() => prefetchRoute(i.path)}
                                                        onFocus={() => prefetchRoute(i.path)}
                                                        className="flex flex-col gap-1 rounded-xl px-4 py-3 hover:bg-theme-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent aria-[current=page]:bg-theme-surface"
                                                    >
                                                        <span className="text-sm font-semibold text-theme-text">{i.name}</span>
                                                        <span className="text-xs leading-relaxed text-theme-text-secondary break-keep">{i.desc}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <LanguageToggle />
                        {/* <AuthButton /> temporarily disabled */}
                        <a href="https://t.me/thetickeriseth" target="_blank" rel="noopener noreferrer" className="bg-theme-surface hover:bg-theme-surface-hover text-theme-text px-5 py-2 rounded-full text-sm font-medium transition-colors border border-theme-border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                            {t('nav.subscribe')}
                        </a>
                    </div>

                    {/* Mobile Nav Button */}
                    <button
                        ref={menuButtonRef}
                        className="md:hidden text-theme-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-expanded={isMobileMenuOpen}
                        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Nav Menu */}
                <div
                    className={`md:hidden backdrop-blur-xl bg-primary-95 border-t border-theme-border-secondary
                        transition-[max-height,opacity] duration-300 ease-in-out
                        ${isMobileMenuOpen ? 'max-h-[calc(100vh-4rem)] overflow-y-auto opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                    role="menu"
                    aria-hidden={!isMobileMenuOpen}
                >
                    <div ref={mobileMenuRef} className="flex flex-col p-6 gap-4">
                        {navGroups.map((g) => (
                            <div key={g.key} className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wide">{t(`nav.groups.${g.key}`)}</span>
                                {g.items.map((i) => (
                                    <Link
                                        key={i.path}
                                        to={i.path}
                                        role="menuitem"
                                        aria-current={isActive(i.path) ? 'page' : undefined}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        onPointerEnter={() => prefetchRoute(i.path)}
                                        onFocus={() => prefetchRoute(i.path)}
                                        className="py-2 text-lg font-medium text-theme-text-secondary hover:text-theme-text aria-[current=page]:text-theme-text focus-visible:text-theme-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                                    >
                                        {i.name}
                                    </Link>
                                ))}
                            </div>
                        ))}
                        <div className="pt-4 border-t border-theme-border flex items-center gap-4">
                            <LanguageToggle />
                            {/* <AuthButton /> temporarily disabled */}
                        </div>
                    </div>
                </div>
            </nav>

            <main id="main-content" className="flex-grow pt-20" role="main">
                {children}
            </main>

            <footer className="py-12 bg-theme-bg-secondary border-t border-theme-border-secondary" role="contentinfo">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <img src="/assets/eck-symbol.svg" alt="" role="presentation" className="h-8 w-auto" />
                                <h3 className="text-xl font-bold text-theme-text">Ethereum Collective Korea</h3>
                            </div>
                            <p className="text-theme-text-muted max-w-sm">
                                {t('footer.description')}
                            </p>
                            <p className="text-theme-text-muted/70 max-w-sm text-xs mt-3">
                                {t('footer.initiative')}
                            </p>
                            <p className="text-theme-text-muted/70 max-w-sm text-xs mt-2">
                                {t('footer.consortium')}
                            </p>
                        </div>
                        <div>
                            <h4 className="text-theme-text font-semibold mb-4">{t('footer.community')}</h4>
                            <ul className="space-y-2 text-theme-text-muted">
                                <li><a href="https://x.com/TickerisETH_kr" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">Twitter</a></li>
                                <li><a href="https://t.me/thetickeriseth" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.telegramChannel')}</a></li>
                                <li><a href="https://t.me/thetickerisethchat" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.telegramChat')}</a></li>
                                <li><a href="https://linkedin.com/company/the-ticker-is-eth/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">LinkedIn</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-theme-text font-semibold mb-4">{t('footer.resources')}</h4>
                            <ul className="space-y-2 text-theme-text-muted">
                                <li><Link to="/contents" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.blog')}</Link></li>
                                <li><Link to="/events" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('nav.events')}</Link></li>
                                <li><a href="https://substack.com/@tickeriseth" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.newsletter')}</a></li>
                                <li><a href="https://t.me/thetickerisethchat" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.contact')}</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-theme-border-secondary text-center text-theme-text-muted text-sm">
                        {t('footer.copyright', { year: new Date().getFullYear() })}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MainLayout;
