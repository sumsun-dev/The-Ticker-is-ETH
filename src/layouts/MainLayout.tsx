import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EthCursorTrail from '../components/cursor/EthCursorTrail';
import LanguageToggle from '../components/common/LanguageToggle';
import AuthButton from '../components/common/AuthButton';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ESC key closes mobile menu
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
        }
    }, [isMobileMenuOpen]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const navLinks = [
        { name: t('nav.about'), path: '/about' },
        { name: t('nav.coreTeam'), path: '/team' },
        { name: t('nav.contributors'), path: '/contributors' },
        { name: t('nav.research'), path: '/research' },
        { name: t('nav.news'), path: '/news' },
        { name: t('nav.ecosystem'), path: '/ecosystem' },
        { name: t('nav.events'), path: '/events' },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-brand-dark overflow-x-hidden cursor-none-desktop">
            {/* Skip Navigation */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:outline-none"
            >
                Skip to main content
            </a>

            <EthCursorTrail />
            <nav
                aria-label="Main navigation"
                className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-brand-dark/80 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'
                    }`}
            >
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2.5" aria-label="Home">
                        <img
                            src="/assets/ticker-eth-logo.svg"
                            alt="The Ticker is ETH"
                            className="h-6 md:h-7 w-auto"
                        />
                        <span className="text-lg md:text-xl font-black tracking-[-0.02em] text-white uppercase italic">
                            The Ticker <span className="text-brand-accent">is ETH</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex gap-8 items-center">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className="text-sm font-medium text-gray-300 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark rounded transition-colors relative group"
                            >
                                {link.name}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-accent transition-all group-hover:w-full" />
                            </Link>
                        ))}
                        <LanguageToggle />
                        <AuthButton />
                        <a href="https://t.me/thetickeriseth" target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors border border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                            {t('nav.subscribe')}
                        </a>
                    </div>

                    {/* Mobile Nav Button */}
                    <button
                        className="md:hidden text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-expanded={isMobileMenuOpen}
                        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Nav Menu */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden bg-brand-dark/95 backdrop-blur-xl border-t border-white/5 overflow-hidden"
                            role="menu"
                        >
                            <div className="flex flex-col p-6 gap-4">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        role="menuitem"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="text-lg font-medium text-gray-300 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                                    >
                                        {link.name}
                                    </Link>
                                ))}
                                <div className="pt-4 border-t border-white/10 flex items-center gap-4">
                                    <LanguageToggle />
                                    <AuthButton />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            <main id="main-content" className="flex-grow pt-20" role="main">
                {children}
            </main>

            <footer className="bg-black/50 border-t border-white/5 py-12" role="contentinfo">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <img src="/assets/ticker-eth-logo.svg" alt="The Ticker is ETH" className="h-8 w-auto" />
                                <h3 className="text-xl font-bold text-white">The ticker is ETH</h3>
                            </div>
                            <p className="text-gray-400 max-w-sm">
                                {t('footer.description')}
                            </p>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">{t('footer.community')}</h4>
                            <ul className="space-y-2 text-gray-400">
                                <li><a href="https://x.com/TickerisETH_kr" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">Twitter</a></li>
                                <li><a href="https://t.me/thetickeriseth" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">Telegram Channel</a></li>
                                <li><a href="https://t.me/thetickerisethchat" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">Telegram Chat</a></li>
                                <li><a href="https://linkedin.com/company/the-ticker-is-eth/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">LinkedIn</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">{t('footer.resources')}</h4>
                            <ul className="space-y-2 text-gray-400">
                                <li><Link to="/research" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.blog')}</Link></li>
                                <li><Link to="/news" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('nav.news')}</Link></li>
                                <li><Link to="/events" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('nav.events')}</Link></li>
                                <li><a href="https://substack.com/@tickeriseth" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.newsletter')}</a></li>
                                <li><a href="https://t.me/thetickerisethchat" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent focus-visible:text-brand-accent focus-visible:outline-none">{t('footer.contact')}</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-white/5 text-center text-gray-500 text-sm">
                        {t('footer.copyright', { year: new Date().getFullYear() })}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MainLayout;
