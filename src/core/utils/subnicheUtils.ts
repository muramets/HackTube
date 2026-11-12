import type { TrendVideo } from '../types/trends';
import type { Subniche, SubnicheReference } from '../types/subniche';
import type { FilterItem } from '../stores/filterStore';

/** Subniche ids selected by the "Subniche" filters (empty when there is no such filter). */
export function getFilteredSubnicheIds(filters: readonly FilterItem[]): string[] {
    const ids = filters
        .filter(filter => filter.type === 'subniche')
        .flatMap(filter => (Array.isArray(filter.value) ? filter.value : [filter.value]))
        .map(String);
    return [...new Set(ids)];
}

/** Turn a Trends video into a reference, capturing a fallback snapshot. */
export function buildReferenceFromTrendVideo(video: TrendVideo, now: number): SubnicheReference {
    return {
        videoId: video.id,
        trendChannelId: video.channelId,
        addedAt: now,
        snapshot: {
            title: video.title,
            thumbnail: video.thumbnail,
            channelTitle: video.channelTitle ?? '',
            viewCount: video.viewCount,
        },
    };
}

/** Case-insensitive name clash check (optionally ignoring the subniche being renamed). */
export function isSubnicheNameTaken(subniches: readonly Subniche[], name: string, exceptId?: string): boolean {
    const wanted = name.trim().toLowerCase();
    return subniches.some(s => s.id !== exceptId && s.name.trim().toLowerCase() === wanted);
}
