import { useEffect } from 'react';

interface PageMeta {
    title: string;
    description?: string;
}

const SITE_NAME = 'ECK — Ethereum Collective Korea';

export default function usePageMeta({ title, description }: PageMeta) {
    useEffect(() => {
        const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
        document.title = fullTitle;

        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', fullTitle);

        if (description) {
            let meta = document.querySelector('meta[name="description"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', 'description');
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', description);

            const ogDesc = document.querySelector('meta[property="og:description"]');
            if (ogDesc) ogDesc.setAttribute('content', description);
        }

        return () => {
            document.title = SITE_NAME;
        };
    }, [title, description]);
}
