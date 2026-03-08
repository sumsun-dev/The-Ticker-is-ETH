import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Landmark,
  ArrowLeftRight,
  Wallet,
  Cable,
  BarChart3,
  Code,
  Image,
  ExternalLink,
  Layers,
  Star,
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import type { EcosystemCategory, EcosystemCategoryInfo, EcosystemTool } from '../types/ecosystem';
import ecosystemData from '../data/ecosystem-tools.json';

const iconMap: Record<string, React.ReactNode> = {
  Search: <Search size={16} />,
  Landmark: <Landmark size={16} />,
  ArrowLeftRight: <ArrowLeftRight size={16} />,
  Wallet: <Wallet size={16} />,
  Cable: <Cable size={16} />,
  BarChart3: <BarChart3 size={16} />,
  Code: <Code size={16} />,
  Image: <Image size={16} />,
};

const categories = ecosystemData.categories as EcosystemCategoryInfo[];
const tools = ecosystemData.tools as EcosystemTool[];

function getFaviconUrl(toolUrl: string): string {
  try {
    const { hostname } = new URL(toolUrl);
    if (!hostname) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  } catch {
    return '';
  }
}

function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none';
}

const Ecosystem: React.FC = () => {
  const { t } = useTranslation('ecosystem');
  const [activeCategory, setActiveCategory] = useState<EcosystemCategory | 'all' | 'highlight'>('all');

  usePageMeta({
    title: 'Ecosystem',
    description: t('ecosystem.description'),
  });

  const highlightTools = useMemo(() => tools.filter((tool) => tool.highlight), []);

  const filteredTools = useMemo(
    () =>
      activeCategory === 'all'
        ? tools
        : activeCategory === 'highlight'
          ? tools.filter((tool) => tool.highlight)
          : tools.filter((tool) => tool.category === activeCategory),
    [activeCategory],
  );

  return (
    <div className="min-h-screen pt-28 pb-20 px-6">
      <div className="container mx-auto relative z-10">
        {/* Page Header */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-brand-primary font-bold tracking-widest uppercase text-sm mb-4 block"
          >
            {t('ecosystem.badge')}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-3xl md:text-5xl font-bold mb-6 leading-tight"
          >
            <Trans
              i18nKey="ecosystem:ecosystem.title"
              components={{
                accent: <span className="text-brand-accent" />,
              }}
            />
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-theme-text-secondary text-lg md:text-xl leading-relaxed"
          >
            {t('ecosystem.description')}
          </motion.p>
        </div>

        {/* Highlight Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
            <Star size={20} className="text-brand-accent" />
            {t('ecosystem.highlight')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {highlightTools.map((tool) => (
              <a
                key={tool.id}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${tool.name} — ${t(tool.descriptionKey)}`}
                className="group p-6 md:p-8 rounded-2xl border border-brand-accent/20 bg-brand-accent/[0.03] backdrop-blur-md hover:border-brand-accent/50 hover:-translate-y-1 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img
                      src={getFaviconUrl(tool.url)}
                      alt={`${tool.name} logo`}
                      width={24}
                      height={24}
                      loading="lazy"
                      decoding="async"
                      onError={handleImgError}
                      className="rounded-sm"
                    />
                  </div>
                  <ExternalLink
                    size={16}
                    className="text-theme-text-muted group-hover:text-brand-accent transition-colors mt-1"
                  />
                </div>
                <h3 className="text-theme-text font-semibold text-base md:text-lg mb-2">
                  {tool.name}
                </h3>
                <p className="text-theme-text-secondary text-sm md:text-base leading-relaxed font-light">
                  {t(tool.descriptionKey)}
                </p>
              </a>
            ))}
          </div>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          <button
            onClick={() => setActiveCategory('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'all'
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                : 'bg-white/[0.03] text-theme-text-secondary border border-theme-border-secondary hover:border-white/20 hover:text-theme-text'
            }`}
          >
            <Layers size={16} />
            {t('ecosystem.all')}
          </button>
          <button
            onClick={() => setActiveCategory('highlight')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'highlight'
                ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/40'
                : 'bg-white/[0.03] text-theme-text-secondary border border-theme-border-secondary hover:border-white/20 hover:text-theme-text'
            }`}
          >
            <Star size={16} />
            {t('ecosystem.highlight')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                  : 'bg-white/[0.03] text-theme-text-secondary border border-theme-border-secondary hover:border-white/20 hover:text-theme-text'
              }`}
            >
              {iconMap[cat.icon]}
              {t(cat.labelKey)}
            </button>
          ))}
        </motion.div>

        {/* Tool Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTools.map((tool) => (
              <motion.a
                key={tool.id}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${tool.name} — ${t(tool.descriptionKey)}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="group p-5 md:p-6 rounded-2xl border border-theme-border-secondary bg-white/[0.02] backdrop-blur-md hover:border-brand-primary/30 hover:-translate-y-1 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img
                      src={getFaviconUrl(tool.url)}
                      alt={`${tool.name} logo`}
                      width={20}
                      height={20}
                      loading="lazy"
                      decoding="async"
                      onError={handleImgError}
                      className="rounded-sm"
                    />
                  </div>
                  <ExternalLink
                    size={14}
                    className="text-theme-text-muted group-hover:text-brand-primary transition-colors mt-1"
                  />
                </div>
                <h3 className="text-theme-text font-semibold text-sm md:text-base mb-1.5">
                  {tool.name}
                </h3>
                <p className="text-theme-text-muted text-xs md:text-sm leading-relaxed line-clamp-2 font-light">
                  {t(tool.descriptionKey)}
                </p>
              </motion.a>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute top-1/3 right-0 translate-x-1/2 w-96 h-96 bg-brand-accent/5 rounded-full blur-[100px]" />
    </div>
  );
};

export default Ecosystem;
