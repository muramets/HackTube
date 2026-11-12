import { describe, it, expect } from 'vitest';
import {
    mergeReferences,
    pickTopReferences,
    resolveReferences,
    TOP_REFERENCE_COUNT,
    type LiveReferenceVideo,
    type SubnicheReference,
} from '../subniche';

const NOW = 1_780_000_000_000;

const reference = (videoId: string, viewCount: number): SubnicheReference => ({
    videoId,
    trendChannelId: 'UC1',
    addedAt: NOW,
    snapshot: { title: `Title ${videoId}`, thumbnail: `https://img/${videoId}.jpg`, channelTitle: 'Cozy Channel', viewCount },
});

const live = (overrides: Partial<LiveReferenceVideo> = {}): LiveReferenceVideo => ({
    title: 'Live title',
    thumbnail: 'https://img/live.jpg',
    channelTitle: 'Cozy Channel',
    viewCount: 9_000,
    publishedAt: '2026-01-01T00:00:00Z',
    ...overrides,
});

describe('mergeReferences', () => {
    it('appends new references and skips duplicates (incoming and existing)', () => {
        const merged = mergeReferences([reference('a', 1)], [reference('a', 99), reference('b', 2), reference('b', 3)]);
        expect(merged.map(r => r.videoId)).toEqual(['a', 'b']);
        expect(merged[0].snapshot.viewCount).toBe(1);
    });
});

describe('resolveReferences', () => {
    it('prefers live Trends data and marks it live', () => {
        const [resolved] = resolveReferences([reference('a', 100)], new Map([['a', live()]]));
        expect(resolved).toMatchObject({ title: 'Live title', viewCount: 9_000, isLive: true });
    });

    it('keeps the snapshot channel title when Trends has none', () => {
        const [resolved] = resolveReferences([reference('a', 100)], new Map([['a', live({ channelTitle: undefined })]]));
        expect(resolved.channelTitle).toBe('Cozy Channel');
    });

    it('falls back to the snapshot when the video is gone', () => {
        const [resolved] = resolveReferences([reference('a', 100)], new Map());
        expect(resolved).toMatchObject({ title: 'Title a', viewCount: 100, isLive: false });
    });
});

describe('pickTopReferences', () => {
    const resolved = resolveReferences([reference('a', 10), reference('b', 300), reference('c', 50), reference('d', 200)], new Map());

    it('returns the most viewed first, limited to the given count', () => {
        expect(pickTopReferences(resolved, TOP_REFERENCE_COUNT).map(r => r.videoId)).toEqual(['b', 'd', 'c']);
    });

    it('ranks all references when no count is given', () => {
        expect(pickTopReferences(resolved).map(r => r.videoId)).toEqual(['b', 'd', 'c', 'a']);
    });

    it('does not mutate the input', () => {
        pickTopReferences(resolved);
        expect(resolved.map(r => r.videoId)).toEqual(['a', 'b', 'c', 'd']);
    });
});
