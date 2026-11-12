import { describe, it, expect } from 'vitest';
import type { TrendVideo } from '../../types/trends';
import type { Subniche, SubnicheReference } from '../../types/subniche';
import {
    buildReferenceFromTrendVideo,
    isSubnicheNameTaken,
    mergeReferences,
    parseSubnicheSortKey,
    pickTopReferences,
    resolveReferences,
    toSubnicheSortKey,
} from '../subnicheUtils';

const NOW = 1_780_000_000_000;

const trendVideo = (id: string, viewCount: number, overrides: Partial<TrendVideo> = {}): TrendVideo => ({
    id,
    channelId: 'UC1',
    channelTitle: 'Cozy Channel',
    publishedAt: '2026-01-01T00:00:00Z',
    publishedAtTimestamp: 0,
    title: `Title ${id}`,
    thumbnail: `https://img/${id}.jpg`,
    viewCount,
    ...overrides,
});

const reference = (id: string, viewCount: number): SubnicheReference => buildReferenceFromTrendVideo(trendVideo(id, viewCount), NOW);

describe('subniche sort key', () => {
    it('round-trips the subniche id', () => {
        expect(parseSubnicheSortKey(toSubnicheSortKey('subniche-1'))).toBe('subniche-1');
    });

    it('returns null for other sorts', () => {
        expect(parseSubnicheSortKey('views')).toBeNull();
        expect(parseSubnicheSortKey('ranking-abc')).toBeNull();
    });
});

describe('buildReferenceFromTrendVideo', () => {
    it('captures ids and a fallback snapshot', () => {
        expect(reference('v1', 500)).toEqual({
            videoId: 'v1',
            trendChannelId: 'UC1',
            addedAt: NOW,
            snapshot: { title: 'Title v1', thumbnail: 'https://img/v1.jpg', channelTitle: 'Cozy Channel', viewCount: 500 },
        });
    });

    it('uses an empty channel title when Trends has none', () => {
        expect(buildReferenceFromTrendVideo(trendVideo('v1', 1, { channelTitle: undefined }), NOW).snapshot.channelTitle).toBe('');
    });
});

describe('mergeReferences', () => {
    it('appends new references and skips duplicates (incoming and existing)', () => {
        const merged = mergeReferences([reference('a', 1)], [reference('a', 99), reference('b', 2), reference('b', 3)]);
        expect(merged.map(r => r.videoId)).toEqual(['a', 'b']);
        expect(merged[0].snapshot.viewCount).toBe(1);
    });
});

describe('resolveReferences', () => {
    it('prefers live Trends data', () => {
        const live = new Map([['a', trendVideo('a', 9_000, { title: 'Renamed' })]]);
        expect(resolveReferences([reference('a', 100)], live)[0]).toMatchObject({ title: 'Renamed', viewCount: 9_000 });
    });

    it('falls back to the snapshot when the video is gone', () => {
        expect(resolveReferences([reference('a', 100)], new Map())[0]).toMatchObject({ title: 'Title a', viewCount: 100 });
    });
});

describe('pickTopReferences', () => {
    const resolved = resolveReferences([reference('a', 10), reference('b', 300), reference('c', 50), reference('d', 200)], new Map());

    it('returns the most viewed first, limited to 3 by default', () => {
        expect(pickTopReferences(resolved).map(r => r.videoId)).toEqual(['b', 'd', 'c']);
    });

    it('returns everything when there are fewer references', () => {
        expect(pickTopReferences(resolved.slice(0, 2), 3)).toHaveLength(2);
    });

    it('does not mutate the input', () => {
        pickTopReferences(resolved);
        expect(resolved.map(r => r.videoId)).toEqual(['a', 'b', 'c', 'd']);
    });
});

describe('isSubnicheNameTaken', () => {
    const subniches: Subniche[] = [{ id: 's1', name: 'Cottage Close-up', references: [], createdAt: 0, updatedAt: 0 }];

    it('matches names case-insensitively, ignoring spaces around', () => {
        expect(isSubnicheNameTaken(subniches, '  cottage close-up ')).toBe(true);
        expect(isSubnicheNameTaken(subniches, 'Forest')).toBe(false);
    });

    it('ignores the subniche being renamed', () => {
        expect(isSubnicheNameTaken(subniches, 'cottage close-up', 's1')).toBe(false);
    });
});
