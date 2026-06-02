import { useEffect } from 'react';

interface JsonLdProps {
    /** 단일 스키마 객체 또는 배열 */
    data: object | object[];
    /** 동일 id 의 script 는 교체된다(중복 방지) */
    id: string;
}

/**
 * <script type="application/ld+json"> 를 <head> 에 주입한다.
 * 클라이언트 렌더 시점에 구글봇(JS 실행)이 구조화 데이터를 읽을 수 있게 한다.
 * 크롤러용 정적 주입은 빌드 스크립트(scripts/generate-seo.ts)가 별도로 처리한다.
 */
export default function JsonLd({ data, id }: JsonLdProps) {
    const json = JSON.stringify(data);
    useEffect(() => {
        const elementId = `jsonld-${id}`;
        let el = document.getElementById(elementId) as HTMLScriptElement | null;
        if (!el) {
            el = document.createElement('script');
            el.type = 'application/ld+json';
            el.id = elementId;
            document.head.appendChild(el);
        }
        el.textContent = json;
        return () => {
            document.getElementById(elementId)?.remove();
        };
    }, [json, id]);

    return null;
}
