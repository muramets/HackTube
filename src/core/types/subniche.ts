/**
 * Subniche — a proven visual formula for covers, backed by competitor reference videos from Trends.
 * Stored per user channel: users/{uid}/channels/{ch}/subniches/{id}.
 * Doc: docs/features/video-management/subniches.md
 */

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

export interface Subniche {
    id: string;
    name: string;
    references: SubnicheReference[];
    createdAt: number;
    updatedAt: number;
}

/** A reference resolved against live Trends data (falls back to the snapshot). */
export interface ResolvedSubnicheReference extends SubnicheReferenceSnapshot {
    videoId: string;
    trendChannelId: string;
    publishedAt?: string;
}
