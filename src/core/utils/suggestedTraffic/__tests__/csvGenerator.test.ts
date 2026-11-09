import { describe, it, expect } from 'vitest';
import { generateTrafficCsv } from '../csvGenerator';
import { parseTrafficCsv } from '../../../../pages/Details/tabs/Traffic/utils/csvParser';
import type { TrafficSource } from '../../../types/suggestedTraffic/traffic';

const toCsvFile = (content: string) => new File([content], 'snapshot.csv', { type: 'text/csv' });

const makeSource = (overrides: Partial<TrafficSource>): TrafficSource => ({
    sourceType: 'Content',
    sourceTitle: 'Video',
    videoId: 'abc',
    impressions: 10,
    ctr: 5,
    views: 1,
    avgViewDuration: '0:01:00',
    watchTimeHours: 0.1,
    ...overrides,
});

describe('generateTrafficCsv', () => {
    it('round-trips enriched sources through the parser without a column mapping', async () => {
        const sources = [
            makeSource({ videoId: 'WLSYf-09NEA', sourceTitle: 'Top 10, Netherlands', channelId: 'UC123' }),
            makeSource({ videoId: 'K5WwxzHh1Fk', notFoundInApi: true }),
        ];
        const total = makeSource({ videoId: null, sourceType: '', sourceTitle: '', impressions: 633, ctr: 0.63, views: 6 });

        const parsed = await parseTrafficCsv(toCsvFile(generateTrafficCsv(sources, total)));

        expect(parsed.sources.map(s => s.videoId)).toEqual(['WLSYf-09NEA', 'K5WwxzHh1Fk']);
        expect(parsed.sources[0]).toMatchObject({ sourceTitle: 'Top 10, Netherlands', channelId: 'UC123' });
        expect(parsed.sources[1].notFoundInApi).toBe(true);
        expect(parsed.totalRow).toMatchObject({ impressions: 633, ctr: 0.63, views: 6 });
    });
});
