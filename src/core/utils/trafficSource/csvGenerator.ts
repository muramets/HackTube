// =============================================================================
// Traffic Source CSV Generator
//
// Builds a normalized Traffic Source CSV from already-parsed metrics.
// We persist THIS file to Cloud Storage instead of the raw upload, so that a
// snapshot always re-parses without a column mapping — even when the original
// export needed manual mapping or used column names we don't recognize yet.
// =============================================================================

import type { TrafficSourceMetric } from '../../types/suggestedTraffic/trafficSource';
import { YT_CSV_CANONICAL_HEADERS } from '../../../../shared/youtubeAnalyticsCsv';
import { quoteCsvField } from '../csvUtils';

const TOTAL_ROW_LABEL = 'Total';

const HEADER_ROW = [
    YT_CSV_CANONICAL_HEADERS.trafficSource,
    YT_CSV_CANONICAL_HEADERS.impressions,
    YT_CSV_CANONICAL_HEADERS.ctr,
    YT_CSV_CANONICAL_HEADERS.views,
    YT_CSV_CANONICAL_HEADERS.avgViewDuration,
    YT_CSV_CANONICAL_HEADERS.watchTimeHours,
].join(',');

const toCsvRow = (metric: TrafficSourceMetric, sourceLabel: string): string => [
    quoteCsvField(sourceLabel),
    metric.impressions,
    metric.ctr,
    metric.views,
    metric.avgViewDuration,
    metric.watchTimeHours,
].join(',');

/**
 * Serialize parsed Traffic Source metrics into a normalized CSV string.
 * The Total row (if present) is written first, mirroring YouTube exports.
 */
export const generateTrafficSourceCsv = (
    metrics: TrafficSourceMetric[],
    totalRow?: TrafficSourceMetric
): string => {
    const rows = [HEADER_ROW];
    if (totalRow) rows.push(toCsvRow(totalRow, TOTAL_ROW_LABEL));
    metrics.forEach(metric => rows.push(toCsvRow(metric, metric.source)));
    return rows.join('\n');
};
