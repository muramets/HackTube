import { describe, it, expect } from 'vitest';
import { generateTrafficSourceCsv } from '../csvGenerator';
import { parseTrafficSourceCsv } from '../parser';
import type { TrafficSourceMetric } from '../../../types/suggestedTraffic/trafficSource';

const toCsvFile = (content: string) => new File([content], 'snapshot.csv', { type: 'text/csv' });

const TOTAL: TrafficSourceMetric = {
    source: 'Total', views: 92, watchTimeHours: 8.8543, avgViewDuration: '0:16:33', impressions: 1213, ctr: 2.23,
};
const METRICS: TrafficSourceMetric[] = [
    { source: 'Browse features', views: 82, watchTimeHours: 7.3516, avgViewDuration: '0:17:35', impressions: 566, ctr: 3.89 },
    { source: 'Suggested videos', views: 6, watchTimeHours: 0.5491, avgViewDuration: '0:08:12', impressions: 633, ctr: 0.63 },
];

describe('generateTrafficSourceCsv', () => {
    it('round-trips through the parser without a column mapping', async () => {
        const csv = generateTrafficSourceCsv(METRICS, TOTAL);
        const parsed = await parseTrafficSourceCsv(toCsvFile(csv));

        expect(parsed.totalRow).toEqual(TOTAL);
        expect(parsed.metrics).toEqual(METRICS);
    });

    it('preserves source names containing commas and quotes', async () => {
        const tricky: TrafficSourceMetric = { ...METRICS[0], source: 'Other, "misc" features' };
        const csv = generateTrafficSourceCsv([tricky]);
        const parsed = await parseTrafficSourceCsv(toCsvFile(csv));

        expect(parsed.metrics).toHaveLength(1);
        expect(parsed.metrics[0].views).toBe(tricky.views);
        expect(parsed.metrics[0].source).toContain('Other, ');
    });

    it('omits the Total row when none is provided', () => {
        const csv = generateTrafficSourceCsv(METRICS);
        expect(csv.split('\n')).toHaveLength(1 + METRICS.length);
        expect(csv).not.toContain('"Total"');
    });
});

describe('parseTrafficSourceCsv — YouTube "Thumbnail" export format', () => {
    it('auto-detects renamed columns without manual mapping', async () => {
        const csv = [
            'Traffic source,Thumbnail impressions,Thumbnail click-through rate (%),Views,Average view duration,Watch time (hours)',
            'Total,1213,2.23,92,0:16:33,8.8543',
            'Browse features,566,3.89,82,0:17:35,7.3516',
            'Notifications,,,2,0:02:36,0.0867',
        ].join('\n');

        const parsed = await parseTrafficSourceCsv(toCsvFile(csv));

        expect(parsed.totalRow).toMatchObject({ impressions: 1213, ctr: 2.23, views: 92 });
        expect(parsed.metrics).toEqual([
            { source: 'Browse features', views: 82, watchTimeHours: 7.3516, avgViewDuration: '0:17:35', impressions: 566, ctr: 3.89 },
            { source: 'Notifications', views: 2, watchTimeHours: 0.0867, avgViewDuration: '0:02:36', impressions: 0, ctr: 0 },
        ]);
    });

    it('still requires mapping when a mandatory column is unrecognizable', async () => {
        const csv = ['Traffic source,Foo,Bar,Views,Average view duration,Watch time (hours)', 'Total,1,2,3,0:00:01,0.1'].join('\n');
        await expect(parseTrafficSourceCsv(toCsvFile(csv))).rejects.toThrow('MAPPING_REQUIRED');
    });
});
