import { describe, it, expect } from 'vitest';
import type { TrendVideo } from '../../types/trends';
import type { Subniche } from '../../types/subniche';
import type { FilterItem } from '../../stores/filterStore';
import { buildReferenceFromTrendVideo, getFilteredSubnicheIds, isSubnicheNameTaken } from '../subnicheUtils';

const NOW = 1_780_000_000_000;

const trendVideo = (overrides: Partial<TrendVideo> = {}): TrendVideo => ({
    id: 'v1',
    channelId: 'UC1',
    channelTitle: 'Cozy Channel',
    publishedAt: '2026-01-01T00:00:00Z',
    publishedAtTimestamp: 0,
    title: 'Title v1',
    thumbnail: 'https://img/v1.jpg',
    viewCount: 500,
    ...overrides,
});

describe('buildReferenceFromTrendVideo', () => {
    it('captures ids and a fallback snapshot', () => {
        expect(buildReferenceFromTrendVideo(trendVideo(), NOW)).toEqual({
            videoId: 'v1',
            trendChannelId: 'UC1',
            addedAt: NOW,
            snapshot: { title: 'Title v1', thumbnail: 'https://img/v1.jpg', channelTitle: 'Cozy Channel', viewCount: 500 },
        });
    });

    it('uses an empty channel title when Trends has none', () => {
        expect(buildReferenceFromTrendVideo(trendVideo({ channelTitle: undefined }), NOW).snapshot.channelTitle).toBe('');
    });
});

describe('getFilteredSubnicheIds', () => {
    const filter = (overrides: Partial<FilterItem>): FilterItem => ({ id: 'f', type: 'subniche', operator: 'equals', value: [], ...overrides });

    it('collects ids from subniche filters only, without duplicates', () => {
        expect(getFilteredSubnicheIds([
            filter({ value: ['s1', 's2'] }),
            filter({ value: ['s2'] }),
            filter({ type: 'title', operator: 'contains', value: 'rain' }),
        ])).toEqual(['s1', 's2']);
    });

    it('is empty without a subniche filter', () => {
        expect(getFilteredSubnicheIds([])).toEqual([]);
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
