import seed from '../data/en/_seed.json';
import { hashKo, localize, type Dict } from './localize';

/**
 * 언어는 주소로 정한다: /en/... 은 영어, 나머지는 한국어. 검색엔진이 두 언어를 따로 색인하려면 주소가 달라야 한다.
 * 언어를 바꾸면 페이지를 새로 받으므로 한 번 뜬 화면 안에서는 값이 바뀌지 않는다.
 */
export const EN_PREFIX = '/en';
export const isEnPath = (pathname: string) => pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`);
export const IS_EN = typeof window !== 'undefined' && isEnPath(window.location.pathname);
/** 라우터 밖의 사이트 내부 링크(<a href>)에 붙이는 접두사 */
export const BASE = IS_EN ? EN_PREFIX : '';

/** 같은 페이지의 다른 언어 주소. 한국어는 /…, 영어는 /en/… (라우터 basename 이 /en 이라 pathname 에는 접두사가 없다) */
export const otherLangHref = (pathname: string, search: string, isEn: boolean) =>
    (isEn ? pathname : `${EN_PREFIX}${pathname === '/' ? '' : pathname}`) + search;

/** 코드에 적어 둔 한국어 데이터(로드맵·포크 등)를 영어판에서 사전으로 바꿔 끼운다 */
export const L = <T>(value: T, dict: Dict): T => (IS_EN ? localize(value, dict) : value);

/** 분류값·상태 라벨처럼 코드가 직접 다루는 짧은 용어의 영어 (src/data/en/_seed.json). 번역 스크립트도 같은 값을 쓴다 */
const SEED: Dict = Object.fromEntries(Object.entries(seed).map(([ko, en]) => [hashKo(ko), en]));
/** 용어를 영어로. 사전에 없으면 그대로 */
export const termEn = <T>(value: T): T => localize(value, SEED);
/** 영어판에서만 용어를 영어로 */
export const LT = <T>(value: T, en: boolean = IS_EN): T => (en ? termEn(value) : value);

/** 화면에 직접 적는 문구: 두 언어를 한자리에 적는다 (한쪽만 쓰면 타입 오류) */
export const T = (ko: string, en: string): string => (IS_EN ? en : ko);
