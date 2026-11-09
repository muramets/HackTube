// =============================================================================
// Suggested Traffic CSV Parser — server-side (no browser APIs)
//
// Parses YouTube "Traffic source" CSV exports.
// Column format (confirmed from real export):
//   Traffic source | Source type | Source title | Impressions |
//   Impressions click-through rate (%) | Views | Average view duration |
//   Watch time (hours)
// Header names vary between export versions (e.g. "Thumbnail impressions") —
// matched via the shared vocabulary in shared/youtubeAnalyticsCsv.ts.
//
// Key characteristics:
//   - Total row: Traffic source="Total", Source type="", Source title=""
//   - Content rows: Traffic source="YT_RELATED.{videoId}"
//   - CTR field is empty when Impressions = 0
//   - Source title may contain commas inside quoted fields
// =============================================================================

import { findYtCsvColumn, type YtCsvField } from '../../../shared/youtubeAnalyticsCsv.js';

export interface SuggestedVideoRow {
    videoId: string;          // Stripped: "abc123" (no YT_RELATED. prefix)
    sourceTitle: string;      // Video title from CSV
    impressions: number;      // 0 if field empty
    ctr: number | null;       // null when impressions = 0 or field empty
    views: number;
    avgViewDuration: string;  // Raw string, e.g. "1:17:33" or "0:04:52"
    watchTimeHours: number;
}

export interface CsvTotalRow {
    impressions: number;
    ctr: number | null;
    views: number;
    watchTimeHours: number;
}

export interface ParsedSnapshot {
    rows: SuggestedVideoRow[];  // Only YT_RELATED Content rows
    total: CsvTotalRow | null;  // null if no Total row present
}

// Our column keys → shared YouTube header vocabulary (SSOT in shared/youtubeAnalyticsCsv.ts)
const COLUMN_FIELDS = {
    source:      'trafficSource',
    sourceType:  'sourceType',
    sourceTitle: 'sourceTitle',
    impressions: 'impressions',
    ctr:         'ctr',
    views:       'views',
    duration:    'avgViewDuration',
    watchTime:   'watchTimeHours',
} as const satisfies Record<string, YtCsvField>;

type ColKey = keyof typeof COLUMN_FIELDS;

/**
 * Parse a single CSV line, respecting RFC 4180 quoted fields.
 * Handles commas inside quotes and escaped double-quotes ("").
 */
function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            // Escaped quote: "" inside a quoted field
            if (inQuote && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (ch === ',' && !inQuote) {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

function parseFloat0(s: string | undefined): number {
    if (!s || s.trim() === '') return 0;
    const n = parseFloat(s.trim());
    return isNaN(n) ? 0 : n;
}

function parseFloatOrNull(s: string | undefined): number | null {
    if (!s || s.trim() === '') return null;
    const n = parseFloat(s.trim());
    return isNaN(n) ? null : n;
}

/**
 * Detect column indices from the header row.
 * Returns a partial mapping — missing columns get index -1.
 */
function detectColumns(headers: string[]): Record<ColKey, number> {
    const result = {} as Record<ColKey, number>;
    for (const key of Object.keys(COLUMN_FIELDS) as ColKey[]) {
        result[key] = findYtCsvColumn(headers, COLUMN_FIELDS[key]);
    }
    return result;
}

const YT_RELATED_PREFIX = 'YT_RELATED.';

/**
 * Parse a YouTube Suggested Traffic CSV string into structured rows.
 *
 * @param csvContent - Raw CSV string read from Cloud Storage
 * @returns ParsedSnapshot with content rows and optional total row
 */
export function parseSuggestedTrafficCsv(csvContent: string): ParsedSnapshot {
    // Normalize line endings
    const lines = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    if (lines.length < 2) {
        return { rows: [], total: null };
    }

    // First line is the header
    const headerFields = parseLine(lines[0]);
    const cols = detectColumns(headerFields);

    const rows: SuggestedVideoRow[] = [];
    let total: CsvTotalRow | null = null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseLine(line);

        const rawSource = fields[cols.source]?.trim() ?? '';
        const rawType   = fields[cols.sourceType]?.trim() ?? '';
        const rawTitle  = fields[cols.sourceTitle]?.trim() ?? '';

        // Total row detection: sourceType and sourceTitle are both empty
        if (rawSource === 'Total' && rawType === '' && rawTitle === '') {
            const rawCtr = cols.ctr >= 0 ? fields[cols.ctr] : undefined;
            total = {
                impressions:   parseFloat0(cols.impressions >= 0 ? fields[cols.impressions] : undefined),
                ctr:           parseFloatOrNull(rawCtr),
                views:         parseFloat0(cols.views >= 0 ? fields[cols.views] : undefined),
                watchTimeHours: parseFloat0(cols.watchTime >= 0 ? fields[cols.watchTime] : undefined),
            };
            continue;
        }

        // Only process YT_RELATED Content rows
        if (!rawSource.startsWith(YT_RELATED_PREFIX) || rawType !== 'Content') {
            continue;
        }

        const videoId = rawSource.slice(YT_RELATED_PREFIX.length);
        const impressions = parseFloat0(cols.impressions >= 0 ? fields[cols.impressions] : undefined);
        const rawCtr = cols.ctr >= 0 ? fields[cols.ctr] : undefined;

        rows.push({
            videoId,
            sourceTitle:      rawTitle,
            impressions,
            // CTR is null when impressions=0 (field is empty in real YouTube exports)
            ctr:              impressions === 0 ? null : parseFloatOrNull(rawCtr),
            views:            parseFloat0(cols.views >= 0 ? fields[cols.views] : undefined),
            avgViewDuration:  fields[cols.duration]?.trim() ?? '',
            watchTimeHours:   parseFloat0(cols.watchTime >= 0 ? fields[cols.watchTime] : undefined),
        });
    }

    return { rows, total };
}
