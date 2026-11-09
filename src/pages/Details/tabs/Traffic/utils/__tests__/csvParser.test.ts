import { describe, it, expect } from 'vitest';
import { parseTrafficCsv } from '../csvParser';

const toCsvFile = (content: string) => new File([content], 'snapshot.csv', { type: 'text/csv' });

describe('parseTrafficCsv — YouTube "Thumbnail" export format', () => {
    it('auto-detects renamed impressions/CTR columns without manual mapping', async () => {
        const csv = [
            'Traffic source,Source type,Source title,Thumbnail impressions,Thumbnail click-through rate (%),Views,Average view duration,Watch time (hours)',
            'Total,,,633,0.63,6,0:08:12,0.5491',
            'YT_RELATED.WLSYf-09NEA,Content,Top 10 Places To Visit in The Netherlands - Travel Guide,1,100,1,0:21:45,0.3626',
            'YT_RELATED.RYRISU5pZkA,Content,Take It Slow Tonight,0,,1,,0.0016',
        ].join('\n');

        const parsed = await parseTrafficCsv(toCsvFile(csv));

        expect(parsed.totalRow).toMatchObject({ impressions: 633, ctr: 0.63, views: 6 });
        expect(parsed.sources).toHaveLength(2);
        expect(parsed.sources[0]).toMatchObject({ videoId: 'WLSYf-09NEA', impressions: 1, ctr: 100, views: 1 });
        expect(parsed.sources[1]).toMatchObject({ videoId: 'RYRISU5pZkA', impressions: 0, ctr: 0 });
    });
});
