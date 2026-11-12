// =============================================================================
// shared/customVideo.ts — Pure builders for creating / updating a custom video
//
// Zero dependencies. Zero I/O. Zero framework imports.
// Shared between the CLI (`scripts/create-custom-video.mjs`) and, in the future,
// the Add Custom Video modal, the Packaging tab and the in-app AI chat tool.
//
// Produces the same document shape the app writes (Add Custom Video modal for
// creation, Packaging tab "Save draft" / "Save as new version" for updates), so
// a video touched from any entry point is indistinguishable in the app.
// The orchestrator (CLI) handles Storage uploads and Firestore writes.
// =============================================================================

import { closeAllPeriods, type PackagingActivePeriod } from './packagingPeriods.js';

export const CUSTOM_VIDEO_ID_PREFIX = 'custom-';

/** YouTube's own thumbnail size limit — a bigger cover could never be published. */
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

/** Covers wider than this are downscaled before upload (same as the browser modal). */
export const MAX_THUMBNAIL_WIDTH = 1280;

const THUMBNAIL_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
};

const FIRST_PACKAGING_VERSION = 1;
const FIRST_COVER_VERSION = 1;

export type DocData = Record<string, unknown>;

export interface CustomVideoCover {
    /** Public download URL of the already-uploaded cover. */
    url: string;
    /** Original file name, shown in the cover history UI. */
    fileName: string;
}

export interface CoverHistoryItem {
    url: string;
    version: number;
    timestamp: number;
    originalName?: string;
}

/** Packaging version as stored in Firestore (`packagingHistory[]`). */
export interface StoredPackagingVersion {
    versionNumber: number;
    startDate: number;
    endDate: number | null;
    activePeriods?: PackagingActivePeriod[];
    configurationSnapshot: DocData | null;
    revision: number;
    checkins?: unknown[];
    [extra: string]: unknown;
}

interface PackagingContent {
    title: string;
    description: string;
    tags: string[];
    cover: CustomVideoCover | null;
    abTestTitles: string[];
    abTestThumbnails: string[];
    localizations?: DocData;
}

// ── Small pure helpers ───────────────────────────────────────────────────────

export function buildCustomVideoId(now: number): string {
    return `${CUSTOM_VIDEO_ID_PREFIX}${now}`;
}

/** Split a comma-separated tag list, trimming blanks and dropping duplicates. */
export function parseTagList(raw: string): string[] {
    const tags = raw.split(',').map(tag => tag.trim()).filter(Boolean);
    return [...new Set(tags)];
}

/** Resolve the content type of a cover file; throws for formats YouTube does not accept. */
export function resolveThumbnailContentType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    const contentType = THUMBNAIL_CONTENT_TYPES[extension];
    if (!contentType) {
        throw new Error(`Unsupported cover format ".${extension}" — use JPG or PNG`);
    }
    return contentType;
}

/** A cover must be downscaled when it is wider than the app uses or heavier than YouTube allows. */
export function needsThumbnailDownscale(widthPx: number, sizeBytes: number): boolean {
    return widthPx > MAX_THUMBNAIL_WIDTH || sizeBytes > MAX_THUMBNAIL_BYTES;
}

/** Final guard after downscaling: YouTube rejects covers over 2 MB. */
export function assertThumbnailWithinLimit(sizeBytes: number): void {
    if (sizeBytes <= MAX_THUMBNAIL_BYTES) return;
    const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);
    throw new Error(`Cover is ${sizeMb} MB even after downscaling — YouTube allows at most 2 MB`);
}

/** Storage path for a video cover — same layout the app uses. */
export function buildCoverStoragePath(
    userId: string,
    channelId: string,
    videoId: string,
    fileName: string,
    now: number,
): string {
    return `users/${userId}/channels/${channelId}/videos/${videoId}/${now}_${fileName}`;
}

/** Prepend an id to an ordered id list (Home order, playlist videoIds) without duplicating it. */
export function prependUniqueId(ids: readonly string[], id: string): string[] {
    return [id, ...ids.filter(existing => existing !== id)];
}

/** Append an id to the end of an ordered id list; an id already present keeps its position. */
export function appendUniqueId(ids: readonly string[], id: string): string[] {
    return ids.includes(id) ? [...ids] : [...ids, id];
}

// ── Playlist membership ──────────────────────────────────────────────────────

export interface PlaylistMembershipInput {
    /** Playlist ids the video is in right now. */
    currentPlaylistIds: readonly string[];
    requestedAddIds: readonly string[];
    requestedRemoveIds: readonly string[];
    /** Playlist-only videos are hidden from Home — removing the last playlist makes them invisible. */
    isPlaylistOnly: boolean;
}

export interface PlaylistMembershipPlan {
    toAdd: string[];
    toRemove: string[];
    /** Requested additions the video is already in (no-op). */
    alreadyIn: string[];
    /** Requested removals the video is not in (no-op). */
    notIn: string[];
    finalPlaylistIds: string[];
}

/** Which playlists to write to, and the membership after the change. Throws on contradictory or orphaning requests. */
export function planPlaylistMembership(input: PlaylistMembershipInput): PlaylistMembershipPlan {
    const addIds = [...new Set(input.requestedAddIds)];
    const removeIds = [...new Set(input.requestedRemoveIds)];
    const conflicting = addIds.filter(id => removeIds.includes(id));
    if (conflicting.length > 0) {
        throw new Error(`Playlist ${conflicting.join(', ')} is both added and removed`);
    }

    const current = new Set(input.currentPlaylistIds);
    const toAdd = addIds.filter(id => !current.has(id));
    const toRemove = removeIds.filter(id => current.has(id));
    const finalPlaylistIds = [...input.currentPlaylistIds.filter(id => !toRemove.includes(id)), ...toAdd];

    if (input.isPlaylistOnly && finalPlaylistIds.length === 0 && toRemove.length > 0) {
        throw new Error('This video is hidden from Home (playlist only) — removing its last playlist would make it invisible. '
            + 'Add it to another playlist in the same command, or show it on Home in the app first.');
    }
    return {
        toAdd,
        toRemove,
        alreadyIn: addIds.filter(id => current.has(id)),
        notIn: removeIds.filter(id => !current.has(id)),
        finalPlaylistIds,
    };
}

// ── Packaging versions ───────────────────────────────────────────────────────

function buildConfigurationSnapshot(content: PackagingContent): DocData {
    return {
        title: content.title,
        description: content.description,
        tags: content.tags,
        coverImage: content.cover?.url ?? '',
        abTestTitles: content.abTestTitles,
        abTestThumbnails: content.abTestThumbnails,
        abTestVariants: content.abTestThumbnails,
        originalName: content.cover?.fileName ?? '',
        ...(content.localizations ? { localizations: content.localizations } : {}),
    };
}

/** A freshly saved version that is live from `now` (Packaging tab "Save as new version"). */
function buildLiveVersion(versionNumber: number, revision: number, content: PackagingContent, now: number): StoredPackagingVersion {
    return {
        versionNumber,
        startDate: now,
        endDate: null,
        activePeriods: [{ startDate: now, endDate: null, closingSnapshotId: null }],
        checkins: [],
        configurationSnapshot: buildConfigurationSnapshot(content),
        revision,
    };
}

/** Next version number: the stored counter, but never one that already exists. */
export function resolveNextVersionNumber(history: readonly StoredPackagingVersion[], storedCounter?: number): number {
    const highestExisting = history.reduce((max, version) => Math.max(max, version.versionNumber), 0);
    return Math.max(storedCounter ?? FIRST_PACKAGING_VERSION, highestExisting + 1);
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CustomVideoInput {
    channelId: string;
    channelTitle: string;
    channelAvatar: string;
    title: string;
    description: string;
    tags: string[];
    cover: CustomVideoCover | null;
    /** true → visible only inside a playlist, never on Home. */
    isPlaylistOnly: boolean;
    /** true → packaging saved as v.1 immediately; false → video stays a draft. */
    saveAsVersion: boolean;
    /** Injected clock (ms) — keeps the builder deterministic and testable. */
    now: number;
}

function requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Title is required');
    return trimmed;
}

/**
 * Build the Firestore document for a new custom video.
 * Undefined values are never emitted (Firestore rejects them).
 */
export function buildCustomVideoDoc(input: CustomVideoInput): DocData {
    const title = requireTitle(input.title);
    const content: PackagingContent = {
        title, description: input.description, tags: input.tags, cover: input.cover,
        abTestTitles: [], abTestThumbnails: [],
    };
    const packaging: DocData = input.saveAsVersion
        ? {
            isDraft: false,
            activeVersion: FIRST_PACKAGING_VERSION,
            currentPackagingVersion: FIRST_PACKAGING_VERSION + 1,
            packagingHistory: [buildLiveVersion(FIRST_PACKAGING_VERSION, 1, content, input.now)],
        }
        : { isDraft: true, activeVersion: 'draft', currentPackagingVersion: FIRST_PACKAGING_VERSION, packagingHistory: [] };

    return {
        id: buildCustomVideoId(input.now),
        title,
        description: input.description,
        tags: input.tags,
        channelId: input.channelId,
        channelTitle: input.channelTitle,
        channelAvatar: input.channelAvatar,
        publishedAt: new Date(input.now).toISOString(),
        isCustom: true,
        createdAt: input.now,
        thumbnail: input.cover?.url ?? '',
        customImage: input.cover?.url ?? '',
        customImageName: input.cover?.fileName ?? '',
        customImageVersion: FIRST_COVER_VERSION,
        highestVersion: input.cover ? FIRST_COVER_VERSION : 0,
        coverHistory: [],
        historyCount: 0,
        abTestTitles: [],
        abTestThumbnails: [],
        abTestResults: { titles: [], thumbnails: [] },
        ...packaging,
        ...(input.isPlaylistOnly ? { isPlaylistOnly: true } : { addedToHomeAt: input.now }),
    };
}

// ── Update ───────────────────────────────────────────────────────────────────

/** Fields of the stored video the update logic reads. */
export interface ExistingVideoState {
    title?: string;
    description?: string;
    tags?: string[];
    customImage?: string;
    customImageName?: string;
    customImageVersion?: number;
    highestVersion?: number;
    coverHistory?: CoverHistoryItem[];
    packagingHistory?: StoredPackagingVersion[];
    currentPackagingVersion?: number;
    packagingRevision?: number;
    abTestTitles?: string[];
    abTestThumbnails?: string[];
    localizations?: DocData;
}

/** Only provided fields change; omitted ones keep their stored value. */
export interface VideoChanges {
    title?: string;
    description?: string;
    tags?: string[];
    cover?: CustomVideoCover;
}

export interface CustomVideoUpdateInput {
    existing: ExistingVideoState;
    changes: VideoChanges;
    /** true → Packaging tab "Save as new version"; false → "Save draft". */
    saveAsVersion: boolean;
    now: number;
}

/**
 * Replace the cover the way the Packaging tab does: the current cover moves to
 * the cover history under its own version number, the new one gets the next number.
 */
function buildCoverReplacement(existing: ExistingVideoState, cover: CustomVideoCover, now: number): DocData {
    const history = existing.coverHistory ?? [];
    const currentVersion = existing.customImageVersion ?? FIRST_COVER_VERSION;
    const currentUrl = existing.customImage ?? '';
    const shouldArchiveCurrent = currentUrl !== '' && !history.some(item => item.url === currentUrl);
    const coverHistory: CoverHistoryItem[] = shouldArchiveCurrent
        ? [{ url: currentUrl, version: currentVersion, timestamp: now, originalName: existing.customImageName ?? '' }, ...history]
        : history;

    const historyMax = coverHistory.reduce((max, item) => Math.max(max, item.version), 0);
    const nextVersion = Math.max(historyMax, currentVersion) + 1;

    return {
        thumbnail: cover.url,
        customImage: cover.url,
        customImageName: cover.fileName,
        customImageVersion: nextVersion,
        highestVersion: Math.max(existing.highestVersion ?? 0, nextVersion),
        coverHistory,
        historyCount: coverHistory.length,
    };
}

function buildPackagingUpdate(input: CustomVideoUpdateInput, content: PackagingContent): DocData {
    const { existing, now } = input;
    const closedHistory = (existing.packagingHistory ?? []).map(version => closeAllPeriods(version, null, now));
    const nextVersionNumber = resolveNextVersionNumber(closedHistory, existing.currentPackagingVersion);

    if (!input.saveAsVersion) {
        return { packagingHistory: closedHistory, currentPackagingVersion: nextVersionNumber, isDraft: true, activeVersion: 'draft' };
    }

    const revision = (existing.packagingRevision ?? 0) + 1;
    const newVersion = buildLiveVersion(nextVersionNumber, revision, content, now);
    return {
        packagingHistory: [...closedHistory, newVersion],
        currentPackagingVersion: nextVersionNumber + 1,
        isDraft: false,
        activeVersion: nextVersionNumber,
    };
}

/**
 * Build the field updates for an existing video (merge-write).
 * `packagingRevision` is bumped so an open Packaging tab detects the change
 * ("Data is out of sync") instead of silently overwriting it.
 */
export function buildCustomVideoUpdate(input: CustomVideoUpdateInput): DocData {
    const { existing, changes, now } = input;
    const title = changes.title === undefined ? existing.title ?? '' : requireTitle(changes.title);
    const coverFields = changes.cover ? buildCoverReplacement(existing, changes.cover, now) : {};
    const currentCover: CustomVideoCover | null = changes.cover
        ?? (existing.customImage ? { url: existing.customImage, fileName: existing.customImageName ?? '' } : null);

    const content: PackagingContent = {
        title,
        description: changes.description ?? existing.description ?? '',
        tags: changes.tags ?? existing.tags ?? [],
        cover: currentCover,
        abTestTitles: existing.abTestTitles ?? [],
        abTestThumbnails: existing.abTestThumbnails ?? [],
        localizations: existing.localizations,
    };

    return {
        title: content.title,
        description: content.description,
        tags: content.tags,
        ...coverFields,
        ...buildPackagingUpdate(input, content),
        packagingRevision: (existing.packagingRevision ?? 0) + 1,
    };
}
