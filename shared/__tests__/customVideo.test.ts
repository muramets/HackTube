import { describe, it, expect } from 'vitest';
import {
    appendUniqueId,
    assertThumbnailWithinLimit,
    buildCoverStoragePath,
    buildCustomVideoDoc,
    buildCustomVideoId,
    buildCustomVideoUpdate,
    needsThumbnailDownscale,
    parseTagList,
    planPlaylistMembership,
    prependUniqueId,
    resolveNextVersionNumber,
    resolveThumbnailContentType,
    MAX_THUMBNAIL_BYTES,
    MAX_THUMBNAIL_WIDTH,
    type CustomVideoInput,
    type ExistingVideoState,
    type StoredPackagingVersion,
} from '../customVideo';

const NOW = 1_780_000_000_000;
const EARLIER = NOW - 86_400_000;

const baseInput = (overrides: Partial<CustomVideoInput> = {}): CustomVideoInput => ({
    channelId: 'ch1',
    channelTitle: 'slow life piano',
    channelAvatar: 'https://avatar',
    title: 'Rainy night piano',
    description: 'Calm piano for sleep',
    tags: ['piano', 'sleep'],
    cover: { url: 'https://cover.jpg', fileName: 'cover.jpg' },
    isPlaylistOnly: false,
    saveAsVersion: false,
    now: NOW,
    ...overrides,
});

const liveVersion = (versionNumber: number): StoredPackagingVersion => ({
    versionNumber,
    startDate: EARLIER,
    endDate: null,
    activePeriods: [{ startDate: EARLIER, endDate: null, closingSnapshotId: null }],
    configurationSnapshot: { title: `v${versionNumber}` },
    revision: 1,
    checkins: [],
});

const existingVideo = (overrides: Partial<ExistingVideoState> = {}): ExistingVideoState => ({
    title: 'Old title',
    description: 'Old description',
    tags: ['old'],
    customImage: 'https://old.jpg',
    customImageName: 'old.jpg',
    customImageVersion: 1,
    highestVersion: 1,
    coverHistory: [],
    packagingHistory: [liveVersion(1)],
    currentPackagingVersion: 2,
    packagingRevision: 3,
    abTestTitles: [],
    abTestThumbnails: [],
    ...overrides,
});

describe('parseTagList', () => {
    it('splits, trims and drops blanks', () => {
        expect(parseTagList(' piano, sleep ,, relax ')).toEqual(['piano', 'sleep', 'relax']);
    });

    it('removes duplicates keeping first occurrence', () => {
        expect(parseTagList('piano,sleep,piano')).toEqual(['piano', 'sleep']);
    });

    it('returns empty list for empty input', () => {
        expect(parseTagList('')).toEqual([]);
    });
});

describe('cover file rules', () => {
    it.each([
        ['cover.jpg', 'image/jpeg'],
        ['cover.JPEG', 'image/jpeg'],
        ['cover.png', 'image/png'],
    ])('accepts %s', (fileName, expected) => {
        expect(resolveThumbnailContentType(fileName)).toBe(expected);
    });

    it('rejects unsupported formats and missing extensions', () => {
        expect(() => resolveThumbnailContentType('cover.webp')).toThrow(/Unsupported cover format/);
        expect(() => resolveThumbnailContentType('cover')).toThrow(/Unsupported cover format/);
    });

    it('asks for downscale when the cover is too wide or too heavy', () => {
        expect(needsThumbnailDownscale(MAX_THUMBNAIL_WIDTH, MAX_THUMBNAIL_BYTES)).toBe(false);
        expect(needsThumbnailDownscale(MAX_THUMBNAIL_WIDTH + 1, 1000)).toBe(true);
        expect(needsThumbnailDownscale(800, MAX_THUMBNAIL_BYTES + 1)).toBe(true);
    });

    it('accepts exactly the size limit and rejects one byte over', () => {
        expect(() => assertThumbnailWithinLimit(MAX_THUMBNAIL_BYTES)).not.toThrow();
        expect(() => assertThumbnailWithinLimit(MAX_THUMBNAIL_BYTES + 1)).toThrow(/at most 2 MB/);
    });

    it('builds the same storage layout the app uses', () => {
        expect(buildCoverStoragePath('u1', 'ch1', 'custom-1', 'cover.jpg', NOW))
            .toBe(`users/u1/channels/ch1/videos/custom-1/${NOW}_cover.jpg`);
    });
});

describe('buildCustomVideoDoc', () => {
    it('builds a draft custom video shown on Home by default', () => {
        const doc = buildCustomVideoDoc(baseInput());

        expect(doc).toMatchObject({
            id: buildCustomVideoId(NOW),
            title: 'Rainy night piano',
            isCustom: true,
            thumbnail: 'https://cover.jpg',
            customImage: 'https://cover.jpg',
            customImageName: 'cover.jpg',
            highestVersion: 1,
            isDraft: true,
            activeVersion: 'draft',
            currentPackagingVersion: 1,
            packagingHistory: [],
            addedToHomeAt: NOW,
            createdAt: NOW,
            publishedAt: new Date(NOW).toISOString(),
        });
        expect(doc).not.toHaveProperty('isPlaylistOnly');
    });

    it('does not fake a view count', () => {
        expect(buildCustomVideoDoc(baseInput())).not.toHaveProperty('viewCount');
    });

    it('marks playlist-only videos and keeps them off Home', () => {
        const doc = buildCustomVideoDoc(baseInput({ isPlaylistOnly: true }));
        expect(doc.isPlaylistOnly).toBe(true);
        expect(doc).not.toHaveProperty('addedToHomeAt');
    });

    it('saves packaging as a live v.1 when requested', () => {
        const doc = buildCustomVideoDoc(baseInput({ saveAsVersion: true }));

        expect(doc).toMatchObject({ isDraft: false, activeVersion: 1, currentPackagingVersion: 2 });
        expect(doc.packagingHistory).toEqual([
            expect.objectContaining({
                versionNumber: 1,
                startDate: NOW,
                endDate: null,
                activePeriods: [{ startDate: NOW, endDate: null, closingSnapshotId: null }],
                configurationSnapshot: expect.objectContaining({
                    title: 'Rainy night piano',
                    description: 'Calm piano for sleep',
                    tags: ['piano', 'sleep'],
                    coverImage: 'https://cover.jpg',
                    originalName: 'cover.jpg',
                }),
            }),
        ]);
    });

    it('trims the title in both the doc and the v.1 snapshot', () => {
        const doc = buildCustomVideoDoc(baseInput({ title: '  Spaced  ', saveAsVersion: true }));
        const [version] = doc.packagingHistory as StoredPackagingVersion[];
        expect(doc.title).toBe('Spaced');
        expect(version.configurationSnapshot?.title).toBe('Spaced');
    });

    it('builds a video without cover', () => {
        const doc = buildCustomVideoDoc(baseInput({ cover: null }));
        expect(doc).toMatchObject({ thumbnail: '', customImage: '', highestVersion: 0 });
    });

    it('rejects a blank title', () => {
        expect(() => buildCustomVideoDoc(baseInput({ title: '   ' }))).toThrow('Title is required');
    });

    it('never emits undefined values (Firestore rejects them)', () => {
        const doc = buildCustomVideoDoc(baseInput({ cover: null, saveAsVersion: true }));
        expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    });
});

describe('resolveNextVersionNumber', () => {
    it('uses the stored counter', () => {
        expect(resolveNextVersionNumber([liveVersion(1)], 2)).toBe(2);
    });

    it('never reuses an existing version number', () => {
        expect(resolveNextVersionNumber([liveVersion(1), liveVersion(3)], 2)).toBe(4);
    });

    it('starts at 1 for an empty history without counter', () => {
        expect(resolveNextVersionNumber([])).toBe(1);
    });
});

describe('buildCustomVideoUpdate', () => {
    it('changes only the passed fields', () => {
        const update = buildCustomVideoUpdate({
            existing: existingVideo(), changes: { title: 'New title' }, saveAsVersion: false, now: NOW,
        });
        expect(update).toMatchObject({ title: 'New title', description: 'Old description', tags: ['old'] });
        expect(update).not.toHaveProperty('customImage');
    });

    it('saves a draft like the Packaging tab: closes live periods, activates draft', () => {
        const update = buildCustomVideoUpdate({
            existing: existingVideo(), changes: { tags: ['new'] }, saveAsVersion: false, now: NOW,
        });
        const [v1] = update.packagingHistory as StoredPackagingVersion[];
        expect(update).toMatchObject({ isDraft: true, activeVersion: 'draft', currentPackagingVersion: 2 });
        expect(v1.endDate).toBe(NOW);
        expect(v1.activePeriods).toEqual([{ startDate: EARLIER, endDate: NOW, closingSnapshotId: null }]);
    });

    it('saves a new live version with the merged packaging', () => {
        const update = buildCustomVideoUpdate({
            existing: existingVideo(), changes: { title: 'New title' }, saveAsVersion: true, now: NOW,
        });
        const history = update.packagingHistory as StoredPackagingVersion[];

        expect(update).toMatchObject({ isDraft: false, activeVersion: 2, currentPackagingVersion: 3 });
        expect(history).toHaveLength(2);
        expect(history[0].endDate).toBe(NOW);
        expect(history[1]).toMatchObject({
            versionNumber: 2,
            startDate: NOW,
            endDate: null,
            revision: 4,
            activePeriods: [{ startDate: NOW, endDate: null, closingSnapshotId: null }],
            configurationSnapshot: expect.objectContaining({
                title: 'New title',
                description: 'Old description',
                tags: ['old'],
                coverImage: 'https://old.jpg',
            }),
        });
    });

    it('archives the current cover under its own version and numbers the new one', () => {
        const update = buildCustomVideoUpdate({
            existing: existingVideo({ customImageVersion: 2, highestVersion: 2 }),
            changes: { cover: { url: 'https://new.jpg', fileName: 'new.jpg' } },
            saveAsVersion: false,
            now: NOW,
        });
        expect(update).toMatchObject({
            thumbnail: 'https://new.jpg',
            customImage: 'https://new.jpg',
            customImageName: 'new.jpg',
            customImageVersion: 3,
            highestVersion: 3,
            historyCount: 1,
            coverHistory: [{ url: 'https://old.jpg', version: 2, timestamp: NOW, originalName: 'old.jpg' }],
        });
    });

    it('does not duplicate a cover that is already in the history', () => {
        const update = buildCustomVideoUpdate({
            existing: existingVideo({ coverHistory: [{ url: 'https://old.jpg', version: 1, timestamp: EARLIER }] }),
            changes: { cover: { url: 'https://new.jpg', fileName: 'new.jpg' } },
            saveAsVersion: false,
            now: NOW,
        });
        expect(update.coverHistory).toHaveLength(1);
        expect(update.customImageVersion).toBe(2);
    });

    it('puts the new cover into the new version snapshot', () => {
        const update = buildCustomVideoUpdate({
            existing: existingVideo(),
            changes: { cover: { url: 'https://new.jpg', fileName: 'new.jpg' } },
            saveAsVersion: true,
            now: NOW,
        });
        const history = update.packagingHistory as StoredPackagingVersion[];
        expect(history[1].configurationSnapshot).toMatchObject({ coverImage: 'https://new.jpg', originalName: 'new.jpg' });
    });

    it('bumps packagingRevision so an open Packaging tab detects the change', () => {
        const update = buildCustomVideoUpdate({ existing: existingVideo(), changes: {}, saveAsVersion: false, now: NOW });
        expect(update.packagingRevision).toBe(4);
    });

    it('keeps localizations in the version snapshot when the video has them', () => {
        const localizations = { de: { languageCode: 'de', title: 'Klavier', description: '', tags: [] } };
        const update = buildCustomVideoUpdate({
            existing: existingVideo({ localizations }), changes: {}, saveAsVersion: true, now: NOW,
        });
        const history = update.packagingHistory as StoredPackagingVersion[];
        expect(history[1].configurationSnapshot).toMatchObject({ localizations });
    });

    it('rejects clearing the title', () => {
        expect(() => buildCustomVideoUpdate({
            existing: existingVideo(), changes: { title: '  ' }, saveAsVersion: false, now: NOW,
        })).toThrow('Title is required');
    });

    it('never emits undefined values (Firestore rejects them)', () => {
        const update = buildCustomVideoUpdate({ existing: {}, changes: { title: 'T' }, saveAsVersion: true, now: NOW });
        expect(JSON.parse(JSON.stringify(update))).toEqual(update);
    });
});

describe('prependUniqueId', () => {
    it('puts the id first', () => {
        expect(prependUniqueId(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
    });

    it('moves an existing id to the front instead of duplicating it', () => {
        expect(prependUniqueId(['a', 'c', 'b'], 'c')).toEqual(['c', 'a', 'b']);
    });
});

describe('appendUniqueId', () => {
    it('puts the id last', () => {
        expect(appendUniqueId(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    });

    it('keeps an existing id where it is', () => {
        expect(appendUniqueId(['a', 'c', 'b'], 'c')).toEqual(['a', 'c', 'b']);
    });

    it('does not mutate the input', () => {
        const ids = ['a'];
        appendUniqueId(ids, 'b');
        expect(ids).toEqual(['a']);
    });
});

describe('planPlaylistMembership', () => {
    const plan = (overrides: Partial<Parameters<typeof planPlaylistMembership>[0]> = {}) => planPlaylistMembership({
        currentPlaylistIds: ['p1'],
        requestedAddIds: [],
        requestedRemoveIds: [],
        isPlaylistOnly: false,
        ...overrides,
    });

    it('adds and removes in one go', () => {
        expect(plan({ requestedAddIds: ['p2'], requestedRemoveIds: ['p1'] })).toEqual({
            toAdd: ['p2'], toRemove: ['p1'], alreadyIn: [], notIn: [], finalPlaylistIds: ['p2'],
        });
    });

    it('skips additions the video is already in and removals it is not in', () => {
        const result = plan({ requestedAddIds: ['p1', 'p2', 'p2'], requestedRemoveIds: ['p9'] });
        expect(result).toMatchObject({ toAdd: ['p2'], toRemove: [], alreadyIn: ['p1'], notIn: ['p9'] });
        expect(result.finalPlaylistIds).toEqual(['p1', 'p2']);
    });

    it('rejects a playlist that is both added and removed', () => {
        expect(() => plan({ requestedAddIds: ['p2'], requestedRemoveIds: ['p2'] })).toThrow(/both added and removed/);
    });

    it('refuses to remove the last playlist of a playlist-only video', () => {
        expect(() => plan({ isPlaylistOnly: true, requestedRemoveIds: ['p1'] })).toThrow(/invisible/);
    });

    it('allows moving a playlist-only video to another playlist', () => {
        expect(plan({ isPlaylistOnly: true, requestedAddIds: ['p2'], requestedRemoveIds: ['p1'] }).finalPlaylistIds).toEqual(['p2']);
    });

    it('lets a Home video leave all playlists', () => {
        expect(plan({ requestedRemoveIds: ['p1'] }).finalPlaylistIds).toEqual([]);
    });
});
