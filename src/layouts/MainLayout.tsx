import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';

import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EthCursorTrail from '../components/cursor/EthCursorTrail';
import LanguageToggle from '../components/common/LanguageToggle';

import AuthButton from '../components/common/AuthButton';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t } = useTranslation();
    const mobileMenuRef = useRef<HTMLDivElement>(null);
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
    }, [isMobileMenuOpen]);

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

    const navLinks = [
        { name: t('nav.about'), path: '/about' },
        { name: t('nav.coreTeam'), path: '/team' },
        { name: t('nav.contributors'), path: '/contributors' },
        { name: t('nav.contents'), path: '/contents' },
        { name: t('nav.ecosystem'), path: '/ecosystem' },
        { name: t('nav.events'), path: '/events' },
    ];

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
                            src="/assets/eck-icon.svg"
                            alt=""
                            role="presentation"
                            className="h-6 md:h-7 w-auto"
                        />
                        <span className="text-lg md:text-xl font-black tracking-[-0.02em] text-theme-text uppercase italic">
                            ECK<span className="inline text-theme-text-secondary normal-case not-italic font-medium text-[10px] sm:text-xs md:text-sm tracking-normal ml-2">Ethereum Collective Korea</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex gap-8 items-center">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className="text-sm font-medium text-theme-text-secondary hover:text-theme-text focus-visible:text-theme-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-theme-bg rounded transition-colors relative group"
                            >
                                {link.name}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-accent transition-all group-hover:w-full" />
                            </Link>
                        ))}
                        <LanguageToggle />
                        <AuthButton />
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
                    className={`md:hidden backdrop-blur-xl overflow-hidden bg-primary-95 border-t border-theme-border-secondary
                        transition-[max-height,opacity] duration-300 ease-in-out
                        ${isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                    role="menu"
                    aria-hidden={!isMobileMenuOpen}
                >
                    <div ref={mobileMenuRef} className="flex flex-col p-6 gap-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                role="menuitem"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="text-lg font-medium text-theme-text-secondary hover:text-theme-text focus-visible:text-theme-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                            >
                                {link.name}
                            </Link>
                        ))}
                        <div className="pt-4 border-t border-theme-border flex items-center gap-4">
                            <LanguageToggle />
                            <AuthButton />
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
                                <img src="/assets/eck-icon.svg" alt="" role="presentation" className="h-8 w-auto" />
                                <h3 className="text-xl font-bold text-theme-text">Ethereum Collective Korea</h3>
                            </div>
                            <p className="text-theme-text-muted max-w-sm">
                                {t('footer.description')}
                            </p>
                            <p className="text-theme-text-muted/70 max-w-sm text-xs mt-3">
                                {t('footer.initiative')}
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
