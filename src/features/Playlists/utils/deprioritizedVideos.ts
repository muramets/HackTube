import type { VideoFadeStyle } from '../../Video/VideoCard';

/** How a deprioritized video looks: mostly transparent and nearly grayscale (restored on hover). */
export const DEPRIORITIZED_FADE: VideoFadeStyle = { opacity: 0.35, saturate: 0.15 };

/** Two fade sources (freshness, deprioritized) don't stack — the stronger one wins. */
export function combineFadeStyles(first?: VideoFadeStyle, second?: VideoFadeStyle): VideoFadeStyle | undefined {
    if (!first) return second;
    if (!second) return first;
    return {
        opacity: Math.min(first.opacity, second.opacity),
        saturate: Math.min(first.saturate, second.saturate),
    };
}

/** Per-video fade for the playlist grid; undefined when nothing is faded (cards render normally). */
export function buildPlaylistFadeMap(
    videoIds: readonly string[],
    freshnessMap: ReadonlyMap<string, VideoFadeStyle> | undefined,
    deprioritizedIds: ReadonlySet<string>,
): Map<string, VideoFadeStyle> | undefined {
    if (!freshnessMap && deprioritizedIds.size === 0) return undefined;
    const fadeMap = new Map<string, VideoFadeStyle>();
    for (const videoId of videoIds) {
        const deprioritizedFade = deprioritizedIds.has(videoId) ? DEPRIORITIZED_FADE : undefined;
        const fade = combineFadeStyles(freshnessMap?.get(videoId), deprioritizedFade);
        if (fade) fadeMap.set(videoId, fade);
    }
    return fadeMap;
}

/** True when every selected video is already deprioritized — the bulk action then restores instead. */
export function areAllDeprioritized(videoIds: Iterable<string>, deprioritizedIds: ReadonlySet<string>): boolean {
    let hasAny = false;
    for (const videoId of videoIds) {
        if (!deprioritizedIds.has(videoId)) return false;
        hasAny = true;
    }
    return hasAny;
}

/** Deprioritized ids that are still in the playlist (stale ids are ignored). */
export function countDeprioritizedInPlaylist(videoIds: readonly string[], deprioritizedIds: ReadonlySet<string>): number {
    return videoIds.filter(videoId => deprioritizedIds.has(videoId)).length;
}

/**
 * Apply a reorder of the visible videos back onto the full order, keeping hidden videos in their slots.
 * Without this, saving the visible order would drop hidden videos from the playlist.
 */
export function mergeVisibleReorder(fullOrder: readonly string[], reorderedVisible: readonly string[]): string[] {
    const visibleSet = new Set(reorderedVisible);
    const nextVisible = reorderedVisible[Symbol.iterator]();
    return fullOrder.map(videoId => (visibleSet.has(videoId) ? nextVisible.next().value ?? videoId : videoId));
}
