import type { TrafficSource } from '../../types/suggestedTraffic/traffic';
import { csvLogger } from '../logger';
import { quoteCsvField } from '../csvUtils';
import { YT_CSV_CANONICAL_HEADERS } from '../../../../shared/youtubeAnalyticsCsv';

export const generateTrafficCsv = (sources: TrafficSource[], totalRow?: TrafficSource): string => {
    csvLogger.debug('Starting generation', { sourcesCount: sources.length, hasTotalRow: !!totalRow });

    // 1. Headers (Standard YouTube Format)
    const headers = [
        YT_CSV_CANONICAL_HEADERS.trafficSource,
        YT_CSV_CANONICAL_HEADERS.sourceType,
        YT_CSV_CANONICAL_HEADERS.sourceTitle,
        YT_CSV_CANONICAL_HEADERS.impressions,
        YT_CSV_CANONICAL_HEADERS.ctr,
        YT_CSV_CANONICAL_HEADERS.views,
        YT_CSV_CANONICAL_HEADERS.avgViewDuration,
        YT_CSV_CANONICAL_HEADERS.watchTimeHours,
        "Channel ID",
        "Not Found"
    ];

    const rows = [];
    rows.push(headers.join(','));

    // 2. Add Total Row if exists
    if (totalRow) {
        rows.push([
            "Total",
            "",
            "",
            totalRow.impressions,
            totalRow.ctr,
            totalRow.views,
            totalRow.avgViewDuration,
            totalRow.watchTimeHours,
            "",
            ""
        ].join(','));
    }

    // 3. Add Sources
    sources.forEach(source => {
        // Format ID: if it has videoId, it's YT_RELATED + videoId, otherwise maybe it's something else?
        // In this app, we filtered for YT_RELATED only.
        const sourceId = source.videoId ? `YT_RELATED.${source.videoId}` : '';

        if (!source.videoId) {
            csvLogger.warn('Source missing videoId', { source });
        }

        const row = [
            sourceId,
            source.sourceType || 'Content',
            quoteCsvField(source.sourceTitle || ''),
            source.impressions,
            source.ctr,
            source.views,
            source.avgViewDuration || '0:00:00',
            source.watchTimeHours,
            source.channelId || '',
            source.notFoundInApi ? 'true' : ''
        ];
        rows.push(row.join(','));
    });

    csvLogger.debug('Generation complete', { rowsCount: rows.length });
    return rows.join('\n');
};
