import { useEffect } from 'react';

interface PageMeta {
    title: string;
    description?: string;
    /** 절대 URL 또는 사이트 루트 기준 경로(/assets/...). 생략 시 기본 OG 이미지 사용 */
    image?: string;
    /** canonical/og:url. 절대 URL 또는 경로(/contents/x). 생략 시 현재 location 사용 */
    canonical?: string;
    type?: 'website' | 'article' | 'profile';
    /** article 전용. "2026.05.31" 또는 ISO 문자열 허용 */
    publishedTime?: string;
    author?: string;
}

const SITE_NAME = 'ECK — Ethereum Collective Korea';
export const SITE_URL = 'https://ethcollective.xyz';
const DEFAULT_IMAGE = `${SITE_URL}/assets/ethereum-korea-logo-dark.png`;

/** 경로/부분 URL을 절대 URL로 정규화 */
function toAbsolute(url: string): string {
    if (!url) return DEFAULT_IMAGE;
    if (/^https?:\/\//.test(url)) return url;
    return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** "2026.05.31" → "2026-05-31". 이미 ISO/하이픈 형식이면 그대로 */
function toIsoDate(date: string): string {
    if (!date) return date;
    if (date.includes('T') || date.includes('-')) return date;
    return date.replace(/\./g, '-');
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

export default function usePageMeta({
    title,
    description,
    image,
    canonical,
    type = 'website',
    publishedTime,
    author,
}: PageMeta) {
    useEffect(() => {
        const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
        document.title = fullTitle;

        setMetaTag('property', 'og:title', fullTitle);
        setMetaTag('name', 'twitter:title', fullTitle);
        setMetaTag('property', 'og:type', type);

        const img = toAbsolute(image || DEFAULT_IMAGE);
        setMetaTag('property', 'og:image', img);
        setMetaTag('name', 'twitter:image', img);

        const url = canonical
            ? toAbsolute(canonical)
            : `${window.location.origin}${window.location.pathname}`;
        setMetaTag('property', 'og:url', url);
        setLink('canonical', url);

        if (description) {
            setMetaTag('name', 'description', description);
            setMetaTag('property', 'og:description', description);
            setMetaTag('name', 'twitter:description', description);
        }

        if (type === 'article') {
            if (publishedTime) setMetaTag('property', 'article:published_time', toIsoDate(publishedTime));
            if (author) setMetaTag('property', 'article:author', author);
        }

        return () => {
            document.title = SITE_NAME;
        };
    }, [title, description, image, canonical, type, publishedTime, author]);
}
