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
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import type { EcosystemCategory, EcosystemCategoryInfo, EcosystemTool } from '../../types/ecosystem';
import ecosystemData from '../../data/ecosystem-tools.json';

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

const EcosystemSection: React.FC = () => {
  const { t } = useTranslation('home');
  const [activeCategory, setActiveCategory] = useState<EcosystemCategory | 'all'>('all');

  const filteredTools = useMemo(
    () =>
      activeCategory === 'all'
        ? tools
        : tools.filter((tool) => tool.category === activeCategory),
    [activeCategory],
  );

  return (
    <section className="py-24 relative overflow-hidden bg-brand-dark">
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-brand-primary font-bold tracking-widest uppercase text-sm mb-4 block"
          >
            {t('ecosystem.badge')}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-3xl md:text-5xl font-bold mb-6 leading-tight"
          >
            <Trans
              i18nKey="home:ecosystem.title"
              components={{
                accent: <span className="text-brand-accent" />,
              }}
            />
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-gray-400 text-lg md:text-xl leading-relaxed"
          >
            {t('ecosystem.description')}
          </motion.p>
        </div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          <button
            onClick={() => setActiveCategory('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'all'
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                : 'bg-white/[0.03] text-gray-400 border border-white/5 hover:border-white/20 hover:text-white'
            }`}
          >
            <Layers size={16} />
            {t('ecosystem.all')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                  : 'bg-white/[0.03] text-gray-400 border border-white/5 hover:border-white/20 hover:text-white'
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
                className="group p-5 md:p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md hover:border-brand-primary/30 hover:-translate-y-1 transition-all"
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
                    className="text-gray-600 group-hover:text-brand-primary transition-colors mt-1"
                  />
                </div>
                <h3 className="text-white font-semibold text-sm md:text-base mb-1.5">
                  {tool.name}
                </h3>
                <p className="text-gray-500 text-xs md:text-sm leading-relaxed line-clamp-2 font-light">
                  {t(tool.descriptionKey)}
                </p>
              </motion.a>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute top-1/3 right-0 translate-x-1/2 w-96 h-96 bg-brand-accent/5 rounded-full blur-[100px]" />
    </section>
  );
};

export default EcosystemSection;
