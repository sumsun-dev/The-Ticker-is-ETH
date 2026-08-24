import { describe, it, expect } from 'vitest';
import { groupOf, sourceLabelOf } from '../ethNewsData';

describe('groupOf', () => {
    it('should classify twitter items regardless of source name', () => {
        expect(groupOf({ source: 'x:VitalikButerin', sourceType: 'twitter' })).toBe('twitter');
    });

    it('should classify telegram items as korea', () => {
        expect(groupOf({ source: 'tg:coinnesskr', sourceType: 'telegram' })).toBe('korea');
    });

    it('should classify official/research rss sources', () => {
        expect(groupOf({ source: 'ef-blog', sourceType: 'rss' })).toBe('research');
        expect(groupOf({ source: 'ethresearch', sourceType: 'rss' })).toBe('research');
        expect(groupOf({ source: 'vitalik', sourceType: 'rss' })).toBe('research');
    });

    it('should classify unknown rss sources as community', () => {
        expect(groupOf({ source: 'reddit-ethereum', sourceType: 'rss' })).toBe('community');
        expect(groupOf({ source: 'some-new-feed', sourceType: 'rss' })).toBe('community');
    });
});

describe('sourceLabelOf', () => {
    it('should render twitter sources as @handle', () => {
        expect(sourceLabelOf({ source: 'x:TimBeiko', sourceType: 'twitter' })).toBe('@TimBeiko');
    });

    it('should use known labels for rss/telegram sources', () => {
        expect(sourceLabelOf({ source: 'ethresearch', sourceType: 'rss' })).toBe('ethresear.ch');
        expect(sourceLabelOf({ source: 'tg:coinnesskr', sourceType: 'telegram' })).toBe('코인니스');
    });

    it('should fall back to the raw source name', () => {
        expect(sourceLabelOf({ source: 'unknown-feed', sourceType: 'rss' })).toBe('unknown-feed');
    });
});
