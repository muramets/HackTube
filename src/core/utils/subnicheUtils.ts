import type { TrendVideo } from '../types/trends';
import type { ResolvedSubnicheReference, Subniche, SubnicheReference } from '../types/subniche';

/** How many top references are pinned above a playlist sorted by subniche. */
export const TOP_REFERENCE_COUNT = 3;

/** Playlist sort key for "show only this subniche": `subniche:{subnicheId}`. */
export const SUBNICHE_SORT_PREFIX = 'subniche:';

export type SubnicheSortKey = `${typeof SUBNICHE_SORT_PREFIX}${string}`;

export function toSubnicheSortKey(subnicheId: string): SubnicheSortKey {
    return `${SUBNICHE_SORT_PREFIX}${subnicheId}`;
}

/** The subniche id behind a playlist sort key, or null for any other sort. */
export function parseSubnicheSortKey(sortBy: string): string | null {
    return sortBy.startsWith(SUBNICHE_SORT_PREFIX) ? sortBy.slice(SUBNICHE_SORT_PREFIX.length) : null;
}

/** Append new references; a video already referenced keeps its original entry. */
export function mergeReferences(current: readonly SubnicheReference[], incoming: readonly SubnicheReference[]): SubnicheReference[] {
    const seen = new Set(current.map(r => r.videoId));
    const added: SubnicheReference[] = [];
    for (const reference of incoming) {
        if (seen.has(reference.videoId)) continue;
        seen.add(reference.videoId);
        added.push(reference);
    }
    return [...current, ...added];
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

/** Prefer live Trends data (fresh view counts); fall back to the snapshot when the video is gone. */
export function resolveReferences(
    references: readonly SubnicheReference[],
    liveVideosById: ReadonlyMap<string, TrendVideo>,
): ResolvedSubnicheReference[] {
    return references.map(reference => {
        const live = liveVideosById.get(reference.videoId);
        if (!live) return { videoId: reference.videoId, trendChannelId: reference.trendChannelId, ...reference.snapshot };
        return {
            videoId: reference.videoId,
            trendChannelId: reference.trendChannelId,
            title: live.title,
            thumbnail: live.thumbnail,
            channelTitle: live.channelTitle ?? reference.snapshot.channelTitle,
            viewCount: live.viewCount,
            publishedAt: live.publishedAt,
        };
    });
}

/** Most viewed references first, limited to `count`. */
export function pickTopReferences(
    references: readonly ResolvedSubnicheReference[],
    count: number = TOP_REFERENCE_COUNT,
): ResolvedSubnicheReference[] {
    return [...references].sort((a, b) => b.viewCount - a.viewCount).slice(0, count);
}

/** Case-insensitive name clash check (optionally ignoring the subniche being renamed). */
export function isSubnicheNameTaken(subniches: readonly Subniche[], name: string, exceptId?: string): boolean {
    const wanted = name.trim().toLowerCase();
    return subniches.some(s => s.id !== exceptId && s.name.trim().toLowerCase() === wanted);
}
