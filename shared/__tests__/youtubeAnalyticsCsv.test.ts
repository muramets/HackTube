// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    findYtCsvColumn,
    YT_CSV_CANONICAL_HEADERS,
    YT_CSV_HEADER_VARIANTS,
    type YtCsvField,
} from '../youtubeAnalyticsCsv';

const LEGACY_SUGGESTED_HEADERS = [
    'Traffic source', 'Source type', 'Source title', 'Impressions',
    'Impressions click-through rate (%)', 'Views', 'Average view duration', 'Watch time (hours)',
];

// YouTube export format since 2026-11 ("Thumbnail ..." columns)
const THUMBNAIL_SUGGESTED_HEADERS = [
    'Traffic source', 'Source type', 'Source title', 'Thumbnail impressions',
    'Thumbnail click-through rate (%)', 'Views', 'Average view duration', 'Watch time (hours)',
];

const THUMBNAIL_TRAFFIC_SOURCE_HEADERS = [
    'Traffic source', 'Thumbnail impressions', 'Thumbnail click-through rate (%)',
    'Views', 'Average view duration', 'Watch time (hours)',
];

const ALL_FIELDS = Object.keys(YT_CSV_HEADER_VARIANTS) as YtCsvField[];

describe('findYtCsvColumn', () => {
    it.each([
        ['legacy suggested export', LEGACY_SUGGESTED_HEADERS],
        ['thumbnail suggested export', THUMBNAIL_SUGGESTED_HEADERS],
    ])('maps every field of the %s to its own column', (_label, headers) => {
        const indices = ALL_FIELDS.map(field => findYtCsvColumn(headers, field));
        expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('maps the thumbnail Traffic Source export (no source type/title columns)', () => {
        const headers = THUMBNAIL_TRAFFIC_SOURCE_HEADERS;
        expect(findYtCsvColumn(headers, 'trafficSource')).toBe(0);
        expect(findYtCsvColumn(headers, 'impressions')).toBe(1);
        expect(findYtCsvColumn(headers, 'ctr')).toBe(2);
        expect(findYtCsvColumn(headers, 'views')).toBe(3);
        expect(findYtCsvColumn(headers, 'avgViewDuration')).toBe(4);
        expect(findYtCsvColumn(headers, 'watchTimeHours')).toBe(5);
        expect(findYtCsvColumn(headers, 'sourceType')).toBe(-1);
    });

    it('ignores case, surrounding quotes and whitespace', () => {
        expect(findYtCsvColumn(['  "THUMBNAIL CLICK-THROUGH RATE (%)" '], 'ctr')).toBe(0);
    });

    it('returns -1 when no header matches', () => {
        expect(findYtCsvColumn(['Foo', 'Bar'], 'views')).toBe(-1);
    });
});

describe('YT_CSV_CANONICAL_HEADERS', () => {
    it('every canonical label is recognized as its own field (normalized files re-parse without mapping)', () => {
        const canonicalRow = ALL_FIELDS.map(field => YT_CSV_CANONICAL_HEADERS[field]);
        ALL_FIELDS.forEach((field, index) => {
            expect(findYtCsvColumn(canonicalRow, field)).toBe(index);
        });
    });
});
