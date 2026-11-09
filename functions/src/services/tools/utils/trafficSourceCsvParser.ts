// =============================================================================
// Traffic Source CSV Parser — server-side (no browser APIs)
//
// Parses YouTube Analytics "Traffic Source" CSV exports into TrafficSourceMetric[].
// Ported from frontend: src/core/utils/trafficSource/parser.ts
//
// Key differences from Suggested Traffic parser (csvParser.ts):
//   - 6 columns (no videoId, sourceType)
//   - First column = source name (not video ID)
//   - Total row is labeled "Total" (first data row in YouTube exports)
//   - No enrichment needed — data is self-contained
//
// Input: raw CSV string (from Cloud Storage buffer.toString("utf-8"))
// =============================================================================

import { findYtCsvColumn, type YtCsvField } from "../../../shared/youtubeAnalyticsCsv.js";

// --- Types ---

export interface TrafficSourceMetric {
    /** Traffic source name: "Suggested videos", "Browse features", etc. */
    source: string;
    views: number;
    watchTimeHours: number;
    avgViewDuration: string; // "HH:MM:SS" format
    impressions: number;
    ctr: number; // e.g. 2.5 means 2.5%
}

export interface ParsedTrafficSourceSnapshot {
    metrics: TrafficSourceMetric[]; // Data rows (excluding Total)
    totalRow: TrafficSourceMetric | null; // Aggregate row, null if missing
}

// --- Header detection ---

// Our column keys → shared YouTube header vocabulary (SSOT in shared/youtubeAnalyticsCsv.ts)
const COLUMN_FIELDS = {
    source: "trafficSource",
    views: "views",
    watchTime: "watchTimeHours",
    avgDuration: "avgViewDuration",
    impressions: "impressions",
    ctr: "ctr",
} as const satisfies Record<string, YtCsvField>;

type ColKey = keyof typeof COLUMN_FIELDS;

// --- Internal helpers ---

/**
 * Parse a single CSV line, respecting RFC 4180 quoted fields.
 */
function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuote && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (ch === "," && !inQuote) {
            fields.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

function detectColumns(headers: string[]): Record<ColKey, number> {
    const result = {} as Record<ColKey, number>;
    for (const key of Object.keys(COLUMN_FIELDS) as ColKey[]) {
        result[key] = findYtCsvColumn(headers, COLUMN_FIELDS[key]);
    }
    return result;
}

function cleanField(s: string | undefined): string {
    // parseLine already handles RFC 4180 quoting — just trim whitespace
    return (s ?? "").trim();
}

function parseFloat0(s: string | undefined): number {
    const cleaned = cleanField(s).replace(/[^0-9.-]/g, "");
    if (!cleaned) return 0;
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function parseInt0(s: string | undefined): number {
    const cleaned = cleanField(s).replace(/[^0-9-]/g, "");
    if (!cleaned) return 0;
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
}

// --- Main parser ---

/**
 * Parse a Traffic Source CSV string into structured metrics.
 *
 * @param csvContent - Raw CSV string read from Cloud Storage
 * @returns ParsedTrafficSourceSnapshot with data rows and optional total row
 */
export function parseTrafficSourceCsv(csvContent: string): ParsedTrafficSourceSnapshot {
    // Normalize line endings
    const lines = csvContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    if (lines.length < 2) {
        return { metrics: [], totalRow: null };
    }

    // Header analysis
    const headerFields = parseLine(lines[0]);
    const cols = detectColumns(headerFields);

    // Validate: at least source + views columns must be found
    if (cols.source === -1 || cols.views === -1) {
        return { metrics: [], totalRow: null };
    }

    const metrics: TrafficSourceMetric[] = [];
    let totalRow: TrafficSourceMetric | null = null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseLine(line);
        if (fields.length < 2) continue;

        const sourceName = cleanField(fields[cols.source]);
        if (!sourceName) continue;

        const metric: TrafficSourceMetric = {
            source: sourceName,
            views: parseInt0(fields[cols.views]),
            watchTimeHours: parseFloat0(cols.watchTime >= 0 ? fields[cols.watchTime] : undefined),
            avgViewDuration: cleanField(cols.avgDuration >= 0 ? fields[cols.avgDuration] : undefined),
            impressions: parseInt0(cols.impressions >= 0 ? fields[cols.impressions] : undefined),
            ctr: parseFloat0(cols.ctr >= 0 ? fields[cols.ctr] : undefined),
        };

        if (sourceName.toLowerCase() === "total") {
            totalRow = metric;
        } else {
            metrics.push(metric);
        }
    }

    return { metrics, totalRow };
}
