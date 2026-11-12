/**
 * Subniche references — pure logic shared by the app and the admin CLI.
 * A reference points at a competitor video in Trends; its snapshot is a fallback when that video is gone.
 * Doc: docs/features/video-management/subniches.md
 */

/** How many top references are pinned above a playlist filtered by one subniche. */
export const TOP_REFERENCE_COUNT = 3;

/** Fallback data captured when the reference was added (used if the trend channel is gone). */
export interface SubnicheReferenceSnapshot {
    title: string;
    thumbnail: string;
    channelTitle: string;
    viewCount: number;
}

export interface SubnicheReference {
    videoId: string;
    trendChannelId: string;
    addedAt: number;
    snapshot: SubnicheReferenceSnapshot;
}

/** The subset of a Trends video document a reference needs. */
export interface LiveReferenceVideo {
    title: string;
    thumbnail: string;
    channelTitle?: string;
    viewCount: number;
    publishedAt?: string;
}

/** A reference resolved against live Trends data (falls back to the snapshot). */
export interface ResolvedSubnicheReference extends SubnicheReferenceSnapshot {
    videoId: string;
    trendChannelId: string;
    publishedAt?: string;
    /** false → the Trends video is gone and the snapshot is shown. */
    isLive: boolean;
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

/** Prefer live Trends data (fresh view counts); fall back to the snapshot when the video is gone. */
export function resolveReferences(
    references: readonly SubnicheReference[],
    liveVideosById: ReadonlyMap<string, LiveReferenceVideo>,
): ResolvedSubnicheReference[] {
    return references.map(reference => {
        const ids = { videoId: reference.videoId, trendChannelId: reference.trendChannelId };
        const live = liveVideosById.get(reference.videoId);
        if (!live) return { ...ids, ...reference.snapshot, isLive: false };
        return {
            ...ids,
            title: live.title,
            thumbnail: live.thumbnail,
            channelTitle: live.channelTitle ?? reference.snapshot.channelTitle,
            viewCount: live.viewCount,
            publishedAt: live.publishedAt,
            isLive: true,
        };
    });
}

/** Most viewed references first, limited to `count` (all of them when count is omitted). */
export function pickTopReferences(
    references: readonly ResolvedSubnicheReference[],
    count: number = references.length,
): ResolvedSubnicheReference[] {
    return [...references].sort((a, b) => b.viewCount - a.viewCount).slice(0, count);
}
