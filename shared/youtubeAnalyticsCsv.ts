// =============================================================================
// YouTube Analytics CSV — header vocabulary (SSOT)
//
// Shared by frontend parsers (Suggested Traffic, Traffic Source) and
// Cloud Functions parsers (AI analysis tools). YouTube renames export columns
// from time to time — update the variants HERE, in one place.
//
// Matching is case-insensitive substring: a header matches a field when it
// CONTAINS any of the variants. Variants are lowercase.
//
// Known renames:
//   2026-11 — "Impressions" → "Thumbnail impressions",
//             "Impressions click-through rate (%)" → "Thumbnail click-through rate (%)"
// =============================================================================

export const YT_CSV_HEADER_VARIANTS = {
    trafficSource: ['traffic source', 'источник трафика'],
    sourceType: ['source type'],
    sourceTitle: ['source title'],
    impressions: ['impressions', 'показы'],
    ctr: ['click-through rate', 'ctr', 'кликабельност'],
    views: ['views', 'просмотры'],
    avgViewDuration: ['average view duration', 'avg duration', 'средняя длительность просмотра'],
    watchTimeHours: ['watch time (hours)', 'watch time', 'время просмотра'],
} as const satisfies Record<string, readonly string[]>;

export type YtCsvField = keyof typeof YT_CSV_HEADER_VARIANTS;

/**
 * Canonical header labels written by our own CSV generators when we persist
 * a normalized snapshot. Every label is guaranteed to match its own variants
 * above, so a normalized file always re-parses without manual mapping.
 */
export const YT_CSV_CANONICAL_HEADERS: Record<YtCsvField, string> = {
    trafficSource: 'Traffic source',
    sourceType: 'Source type',
    sourceTitle: 'Source title',
    impressions: 'Impressions',
    ctr: 'Impressions click-through rate (%)',
    views: 'Views',
    avgViewDuration: 'Average view duration',
    watchTimeHours: 'Watch time (hours)',
};

/**
 * Find the index of the first header that matches any variant of `field`.
 * @param headers — raw header cells from the first CSV line
 * @returns column index, or -1 if not found
 */
export const findYtCsvColumn = (headers: readonly string[], field: YtCsvField): number => {
    const variants: readonly string[] = YT_CSV_HEADER_VARIANTS[field];
    return headers.findIndex(header => {
        const normalized = header.toLowerCase().replace(/['"]/g, '').trim();
        return variants.some(variant => normalized.includes(variant));
    });
};
