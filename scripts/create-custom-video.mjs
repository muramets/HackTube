#!/usr/bin/env node
// =============================================================================
// create-custom-video.mjs — CLI for preparing custom videos for publishing
//
// Three modes:
//   --list                 Print channels and their playlists (names + ids).
//   (default) create       New custom video: cover, title, description, tags;
//                          optionally into a playlist and saved as v.1.
//   --video <id>           Update an existing custom video: only the passed
//                          fields change; saved as draft or as a new version.
//                          Playlists can be added (--playlist) and removed
//                          (--remove-playlist); added videos go last.
//   --delete --video <id>  Delete a video the way the app does (Storage files,
//                          subcollections, Home order, playlist references).
// Nothing is uploaded to YouTube.
//
// Usage:
//   1. Build functions once (the CLI imports the compiled shared builders):
//        cd functions && npm run build
//   2. Run without --execute first: validates input, prints the plan, writes nothing.
//   3. Same command + --execute to apply.
//   Run with --help for all flags.
//
// Auth: Application Default Credentials (`gcloud auth application-default login`).
// Single source of truth: shared/customVideo.ts + shared/packagingPeriods.ts,
// compiled to functions/lib/shared/.
// Doc: docs/features/video-management/create-custom-video-cli.md
// =============================================================================

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { resolve, basename, extname, join } from 'path';
import { readFileSync, statSync, existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { parseArgs } from 'util';

const PROJECT_ID = 'mytube-46104';
const STORAGE_BUCKET = 'mytube-46104.firebasestorage.app';
const COVER_CACHE_CONTROL = 'public,max-age=31536000';
const DOWNSCALE_JPEG_QUALITY = '85';
const SHARED_BUILDER_PATH = new URL('../functions/lib/shared/customVideo.js', import.meta.url).pathname;

const HELP = `
Prepare custom videos for publishing (nothing is uploaded to YouTube).

Modes:
  --list                       Print channels with their playlists (use with --channel to filter)
  (default)                    Create a new video
  --video <id>                 Update an existing custom video (only passed fields change)
  --delete --video <id>        Delete a video with its files, history and playlist references

Fields:
  --title <text>               Title (required when creating)
  --description <text>         Description (use --description-file for multi-line text)
  --description-file <path>    Read the description from a UTF-8 text file
  --tags <a,b,c>               Comma-separated tags (replaces the whole tag list)
  --thumbnail <path>           Cover, JPG or PNG. Larger than 1280px or 2 MB → downscaled automatically (macOS sips)

Where:
  --channel <name|id>          Internal channel (exact name, case-insensitive, or id).
                               Optional when --playlist or --video identifies the channel.
  --playlist <name|id>         Add the video to the end of this playlist (repeat for several playlists).
                               A video already in the playlist keeps its position.
  --remove-playlist <name|id>  Remove the video from this playlist (update mode, repeatable)
  --playlist-only              Create the video only in the playlist, not on Home (create mode, needs --playlist)
  --user <uid>                 Owner uid (auto-detected when the project has one user)

Packaging:
  --save-version               Save as a packaging version (v.1 on create, next version on update).
                               Without it the video is saved as a draft.

  --execute                    Apply (default is a dry run that only prints the plan)
  --help                       Show this help
`;

// ── Input ────────────────────────────────────────────────────────────────────

function readCliOptions() {
    const { values } = parseArgs({
        options: {
            list: { type: 'boolean', default: false },
            delete: { type: 'boolean', default: false },
            video: { type: 'string' },
            user: { type: 'string' },
            channel: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            'description-file': { type: 'string' },
            tags: { type: 'string' },
            thumbnail: { type: 'string' },
            playlist: { type: 'string', multiple: true },
            'remove-playlist': { type: 'string', multiple: true },
            'playlist-only': { type: 'boolean', default: false },
            'save-version': { type: 'boolean', default: false },
            execute: { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        strict: true,
    });
    return values;
}

const FIELD_FLAGS = ['title', 'description', 'description-file', 'tags', 'thumbnail', 'playlist', 'remove-playlist',
    'playlist-only', 'save-version'];

function validateDeleteOptions(options) {
    if (!options.video) throw new Error('--delete requires --video <id>');
    const conflicting = FIELD_FLAGS.filter((flag) => options[flag] !== undefined && options[flag] !== false);
    if (conflicting.length > 0) {
        throw new Error(`--delete cannot be combined with ${conflicting.map((f) => `--${f}`).join(', ')}`);
    }
}

function validateOptions(options) {
    const isUpdate = Boolean(options.video);
    if (!isUpdate && !options.title?.trim()) throw new Error('Missing required flag: --title');
    if (options.description !== undefined && options['description-file']) {
        throw new Error('Use either --description or --description-file, not both');
    }
    if (options['playlist-only'] && isUpdate) throw new Error('--playlist-only is only available when creating a video');
    if (options['playlist-only'] && !options.playlist) throw new Error('--playlist-only requires --playlist');
    if (options['remove-playlist'] && !isUpdate) throw new Error('--remove-playlist is only available with --video');
    if (!isUpdate && !options.channel && !options.playlist) {
        throw new Error('Pass --channel or --playlist so the video knows where to go (see --list)');
    }
}

/** Only fields the caller passed — omitted ones keep their stored value on update. */
function readFieldChanges(options, parseTagList) {
    const changes = {};
    if (options.title !== undefined) changes.title = options.title;
    if (options['description-file']) changes.description = readFileSync(options['description-file'], 'utf-8').trim();
    else if (options.description !== undefined) changes.description = options.description;
    if (options.tags !== undefined) changes.tags = parseTagList(options.tags);
    return changes;
}

// ── Cover preparation (local file → upload-ready file) ──────────────────────

function readImageWidth(path) {
    const output = execFileSync('sips', ['-g', 'pixelWidth', path], { encoding: 'utf-8' });
    const match = output.match(/pixelWidth:\s*(\d+)/);
    if (!match) throw new Error(`Could not read image width of ${path}`);
    return Number(match[1]);
}

function downscaleToJpeg(sourcePath, widthPx, maxWidth) {
    const outputPath = join(mkdtempSync(join(tmpdir(), 'cover-')), `${basename(sourcePath, extname(sourcePath))}.jpg`);
    const resizeArgs = widthPx > maxWidth ? ['--resampleWidth', String(maxWidth)] : [];
    execFileSync('sips', [...resizeArgs, '-s', 'format', 'jpeg', '-s', 'formatOptions', DOWNSCALE_JPEG_QUALITY,
        sourcePath, '--out', outputPath], { stdio: 'ignore' });
    return outputPath;
}

function prepareCover(thumbnailPath, builder) {
    if (!thumbnailPath) return null;
    if (!existsSync(thumbnailPath)) throw new Error(`Cover file not found: ${thumbnailPath}`);
    builder.resolveThumbnailContentType(basename(thumbnailPath));

    const originalBytes = statSync(thumbnailPath).size;
    const originalWidth = readImageWidth(thumbnailPath);
    const uploadPath = builder.needsThumbnailDownscale(originalWidth, originalBytes)
        ? downscaleToJpeg(thumbnailPath, originalWidth, builder.MAX_THUMBNAIL_WIDTH)
        : thumbnailPath;

    const sizeBytes = statSync(uploadPath).size;
    builder.assertThumbnailWithinLimit(sizeBytes);
    const fileName = basename(uploadPath);
    return {
        path: uploadPath,
        fileName,
        sizeBytes,
        contentType: builder.resolveThumbnailContentType(fileName),
        downscaledFrom: uploadPath === thumbnailPath ? null : { widthPx: originalWidth, sizeBytes: originalBytes },
    };
}

// ── Firestore lookups ────────────────────────────────────────────────────────

const docName = (snap) => snap.data().name ?? '(no name)';
const formatEntry = (snap) => `"${docName(snap)}"  [${snap.id}]`;

/** Find a doc by id, or by exact case-insensitive name; error lists what exists. */
async function findByIdOrName(db, collectionPath, query, kind) {
    const byId = await db.doc(`${collectionPath}/${query}`).get();
    if (byId.exists) return byId;

    const all = await db.collection(collectionPath).get();
    const wanted = query.trim().toLowerCase();
    const matches = all.docs.filter((d) => docName(d).trim().toLowerCase() === wanted);
    if (matches.length === 1) return matches[0];

    const available = all.docs.map((d) => `  - ${formatEntry(d)}`).join('\n');
    const reason = matches.length > 1 ? `Several ${kind}s are named "${query}"` : `${kind} "${query}" not found`;
    throw new Error(`${reason}. Pass the id instead. Available ${kind}s:\n${available}`);
}

/** Explicit --user wins; otherwise the project's only user is used. */
async function resolveUserId(db, userOption) {
    if (userOption?.trim()) return userOption.trim();
    const users = await db.collection('users').listDocuments();
    if (users.length === 1) return users[0].id;
    const available = users.map((u) => `  - ${u.id}`).join('\n');
    throw new Error(`Several users found — pass --user <uid>. Available:\n${available}`);
}

/** Find which channel holds a playlist (by id or name) when --channel is omitted. */
async function findChannelByPlaylist(db, channels, playlistQuery) {
    const wanted = playlistQuery.trim().toLowerCase();
    const hits = [];
    for (const channel of channels) {
        const playlists = await channel.ref.collection('playlists').get();
        const playlist = playlists.docs.find((p) => p.id === playlistQuery || docName(p).trim().toLowerCase() === wanted);
        if (playlist) hits.push({ channel, playlist });
    }
    if (hits.length === 1) return hits[0].channel;
    if (hits.length === 0) throw new Error(`Playlist "${playlistQuery}" not found in any channel (see --list)`);
    const where = hits.map((h) => `  - ${formatEntry(h.channel)}`).join('\n');
    throw new Error(`Playlist "${playlistQuery}" exists in several channels — add --channel. Found in:\n${where}`);
}

async function findChannelByVideo(channels, videoId) {
    for (const channel of channels) {
        const video = await channel.ref.collection('videos').doc(videoId).get();
        if (video.exists) return channel;
    }
    throw new Error(`Video ${videoId} not found in any channel`);
}

async function resolveChannel(db, userId, options) {
    const channelsPath = `users/${userId}/channels`;
    if (options.channel) return findByIdOrName(db, channelsPath, options.channel, 'channel');
    const channels = (await db.collection(channelsPath).get()).docs;
    if (options.video) return findChannelByVideo(channels, options.video);
    return findChannelByPlaylist(db, channels, options.playlist[0]);
}

// ── List mode ────────────────────────────────────────────────────────────────

async function printChannelsWithPlaylists(db, userId, channelFilter) {
    const channelsPath = `users/${userId}/channels`;
    const channels = channelFilter
        ? [await findByIdOrName(db, channelsPath, channelFilter, 'channel')]
        : (await db.collection(channelsPath).get()).docs;

    for (const channel of channels) {
        console.log(`Channel ${formatEntry(channel)}`);
        const playlists = await channel.ref.collection('playlists').get();
        if (playlists.empty) console.log('  (no playlists)');
        const sorted = [...playlists.docs].sort((a, b) => docName(a).localeCompare(docName(b)));
        for (const playlist of sorted) {
            const count = Array.isArray(playlist.data().videoIds) ? playlist.data().videoIds.length : 0;
            console.log(`  - ${formatEntry(playlist)}  ${count} videos`);
        }
    }
}

// ── Writes ───────────────────────────────────────────────────────────────────

async function uploadCover({ bucket, getDownloadURL, builder }, cover, userId, channelId, videoId, now) {
    const file = bucket.file(builder.buildCoverStoragePath(userId, channelId, videoId, cover.fileName, now));
    await file.save(readFileSync(cover.path), {
        contentType: cover.contentType,
        metadata: { cacheControl: COVER_CACHE_CONTROL },
    });
    return { url: await getDownloadURL(file), fileName: cover.fileName };
}

/**
 * Rewrite an id-list field (Home order, playlist videoIds) inside a transaction, so a concurrent
 * edit in the app is not lost. Skips the write when the list does not change.
 */
async function updateIdListInDoc(db, ref, field, transformIds, extraFields = {}) {
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists && Array.isArray(snap.data()[field]) ? snap.data()[field] : [];
        const next = transformIds(current);
        if (next.length === current.length && next.every((id, i) => id === current[i])) return;
        tx.set(ref, { [field]: next, ...extraFields }, { merge: true });
    });
}

const withoutId = (id) => (ids) => ids.filter((existing) => existing !== id);

/** Drop a video from a playlist: its slot in videoIds and its "deprioritized" mark, in one transaction. */
async function removeVideoFromPlaylistDoc(db, playlistRef, videoId) {
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(playlistRef);
        if (!snap.exists) return;
        const listOf = (field) => (Array.isArray(snap.data()[field]) ? snap.data()[field] : []);
        if (!listOf('videoIds').includes(videoId) && !listOf('deprioritizedVideoIds').includes(videoId)) return;
        tx.update(playlistRef, {
            videoIds: withoutId(videoId)(listOf('videoIds')),
            deprioritizedVideoIds: withoutId(videoId)(listOf('deprioritizedVideoIds')),
            updatedAt: Date.now(),
        });
    });
}

async function createVideo(ctx, plan) {
    const { db, builder } = ctx;
    const { userId, channel, playlist, cover, changes, options } = plan;
    const channelPath = `users/${userId}/channels/${channel.id}`;
    const now = Date.now();
    const videoId = builder.buildCustomVideoId(now);
    const uploadedCover = cover ? await uploadCover(ctx, cover, userId, channel.id, videoId, now) : null;

    const videoDoc = builder.buildCustomVideoDoc({
        channelId: channel.id,
        channelTitle: channel.data().name ?? '',
        channelAvatar: channel.data().avatar ?? '',
        title: changes.title,
        description: changes.description ?? '',
        tags: changes.tags ?? [],
        cover: uploadedCover,
        isPlaylistOnly: options['playlist-only'],
        saveAsVersion: options['save-version'],
        now,
    });
    await db.doc(`${channelPath}/videos/${videoId}`).create(videoDoc);
    console.log(`Created video ${videoId}`);

    if (!options['playlist-only']) {
        await updateIdListInDoc(db, db.doc(`${channelPath}/settings/videoOrder`), 'order',
            (ids) => builder.prependUniqueId(ids, videoId));
        console.log('Placed first on Home');
    }
    return videoId;
}

async function updateVideo(ctx, plan) {
    const { db, builder } = ctx;
    const { userId, channel, cover, changes, options } = plan;
    const videoId = options.video;
    const videoRef = db.doc(`users/${userId}/channels/${channel.id}/videos/${videoId}`);
    const now = Date.now();
    const uploadedCover = cover ? await uploadCover(ctx, cover, userId, channel.id, videoId, now) : null;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(videoRef);
        if (!snap.exists) throw new Error(`Video ${videoId} disappeared before the update`);
        const update = builder.buildCustomVideoUpdate({
            existing: snap.data(),
            changes: uploadedCover ? { ...changes, cover: uploadedCover } : changes,
            saveAsVersion: options['save-version'],
            now,
        });
        tx.update(videoRef, update);
    });
    console.log(`Updated video ${videoId}`);
    return videoId;
}

/** Create, update, or (playlist-only change of an existing video) leave the video doc untouched. */
async function applyVideoWrite(ctx, plan) {
    if (!plan.existing) return createVideo(ctx, plan);
    if (!touchesVideoDoc(plan.changes, plan.options)) return plan.options.video;
    return updateVideo(ctx, plan);
}

// ── Delete ───────────────────────────────────────────────────────────────────

/** Everything the app removes when a video is deleted — collected for the dry-run report. */
async function buildDeletePlan({ db, bucket }, options) {
    const userId = await resolveUserId(db, options.user);
    const channel = await resolveChannel(db, userId, options);
    const videoId = options.video;
    const videoRef = channel.ref.collection('videos').doc(videoId);
    const video = await videoRef.get();
    if (!video.exists) throw new Error(`Video ${videoId} not found in channel ${formatEntry(channel)}`);

    const [storageFiles] = await bucket.getFiles({ prefix: `${videoRef.path}/` });
    const subcollections = [];
    for (const sub of await videoRef.listCollections()) {
        subcollections.push({ name: sub.id, docCount: (await sub.get()).size });
    }
    const playlists = (await channel.ref.collection('playlists').where('videoIds', 'array-contains', videoId).get()).docs;
    const order = (await channel.ref.collection('settings').doc('videoOrder').get()).data()?.order ?? [];
    return { userId, channel, videoId, videoRef, video, storageFiles, subcollections, playlists, isOnHome: order.includes(videoId) };
}

function printDeletePlan(plan, execute) {
    const { channel, videoId, video, storageFiles, subcollections, playlists, isOnHome } = plan;
    const subSummary = subcollections.map((s) => `${s.name} (${s.docCount})`).join(', ') || '(none)';
    console.log(`=== Delete Video ${videoId} ===`);
    console.log(`Mode:           ${execute ? 'EXECUTE' : 'DRY-RUN (nothing is deleted)'}`);
    console.log(`Channel:        ${formatEntry(channel)}`);
    console.log(`Title:          "${video.data().title ?? '(no title)'}"  — ${video.data().isCustom ? 'custom video' : 'YouTube video'}`);
    console.log(`Storage files:  ${storageFiles.length}`);
    console.log(`Subcollections: ${subSummary}`);
    console.log(`Home:           ${isOnHome ? 'will be removed from Home order' : 'not on Home'}`);
    console.log(`Playlists:      ${playlists.length ? playlists.map(formatEntry).join(', ') : '(none)'}\n`);
}

/** Same order as VideoService.deleteVideo: files → docs → Home order → playlists. */
async function deleteVideo({ db }, plan) {
    const { channel, videoId, videoRef, storageFiles, playlists, isOnHome } = plan;
    await Promise.all(storageFiles.map((file) => file.delete({ ignoreNotFound: true })));
    await db.recursiveDelete(videoRef);
    console.log(`Deleted video ${videoId} (${storageFiles.length} storage files)`);

    if (isOnHome) {
        await updateIdListInDoc(db, channel.ref.collection('settings').doc('videoOrder'), 'order', withoutId(videoId));
        console.log('Removed from Home');
    }
    for (const playlist of playlists) {
        await removeVideoFromPlaylistDoc(db, playlist.ref, videoId);
        console.log(`Removed from playlist "${docName(playlist)}"`);
    }
}

async function runDelete(ctx, options) {
    validateDeleteOptions(options);
    const plan = await buildDeletePlan(ctx, options);
    printDeletePlan(plan, options.execute);
    if (!options.execute) {
        console.log('Dry run only. Re-run with --execute to delete.');
        return;
    }
    await deleteVideo(ctx, plan);
    console.log('\nDone.');
}

// ── Plan output ──────────────────────────────────────────────────────────────

function describeCover(cover) {
    if (!cover) return '(unchanged / none)';
    const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
    const source = cover.downscaledFrom
        ? ` — downscaled from ${cover.downscaledFrom.widthPx}px, ${kb(cover.downscaledFrom.sizeBytes)}`
        : '';
    return `${cover.fileName} (${kb(cover.sizeBytes)})${source}`;
}

function describeField(value, fallback) {
    return value === undefined ? fallback : value;
}

function describePlaylists({ playlistsById, membership }) {
    const names = (ids) => ids.map((id) => formatEntry(playlistsById.get(id))).join(', ');
    const lines = [`after: ${membership.finalPlaylistIds.length ? names(membership.finalPlaylistIds) : '(none)'}`];
    if (membership.toAdd.length) lines.push(`+ add (last): ${names(membership.toAdd)}`);
    if (membership.toRemove.length) lines.push(`- remove:     ${names(membership.toRemove)}`);
    if (membership.alreadyIn.length) lines.push(`= already in, position kept: ${names(membership.alreadyIn)}`);
    if (membership.notIn.length) lines.push(`= not in, nothing to remove: ${names(membership.notIn)}`);
    return lines.join('\n              ');
}

function describePackaging({ existing, changes, options }) {
    if (existing && !touchesVideoDoc(changes, options)) return '(unchanged — only playlists change)';
    return options['save-version'] ? 'saved as a new version' : 'draft';
}

function printPlan(plan) {
    const { options, userId, channel, cover, changes, existing } = plan;
    const unchanged = '(unchanged)';
    console.log(`=== ${existing ? `Update Video ${options.video}` : 'Create Custom Video'} ===`);
    console.log(`Mode:         ${options.execute ? 'EXECUTE' : 'DRY-RUN (nothing is written)'}`);
    console.log(`User:         ${userId}`);
    console.log(`Channel:      ${formatEntry(channel)}`);
    if (existing) console.log(`Current:      "${existing.title}" — ${existing.isDraft ? 'draft' : `v.${existing.activeVersion}`} active`);
    console.log(`Title:        ${describeField(changes.title?.trim(), unchanged)}`);
    console.log(`Description:  ${changes.description === undefined ? unchanged : `${changes.description.length} chars`}`);
    console.log(`Tags:         ${changes.tags === undefined ? unchanged : changes.tags.join(', ') || '(none)'}`);
    console.log(`Cover:        ${describeCover(cover)}`);
    console.log(`Playlists:    ${describePlaylists(plan)}`);
    if (!existing) console.log(`Home:         ${options['playlist-only'] ? 'hidden (playlist only)' : 'first on Home'}`);
    console.log(`Packaging:    ${describePackaging(plan)}\n`);
    if (existing?.publishedVideoId && options['save-version']) {
        console.log('Note: this video is published. The Packaging tab would ask for a Suggested Traffic CSV');
        console.log('      to close the previous version; the CLI closes it without that snapshot.\n');
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function loadSharedBuilder() {
    if (!existsSync(SHARED_BUILDER_PATH)) {
        throw new Error('Compiled builder not found. Run: cd functions && npm run build');
    }
    return import(pathToFileURL(resolve(SHARED_BUILDER_PATH)).href);
}

function initFirebase() {
    const require = createRequire(new URL('../functions/package.json', import.meta.url).pathname);
    const admin = require('firebase-admin');
    const { getDownloadURL } = require('firebase-admin/storage');
    admin.initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
    return { db: admin.firestore(), bucket: admin.storage().bucket(), getDownloadURL };
}

/** Packaging fields are editable on custom videos only; playlist membership works for any video. */
async function loadExistingVideo(db, userId, channel, videoId, touchesVideoDoc) {
    if (!videoId) return null;
    const snap = await db.doc(`users/${userId}/channels/${channel.id}/videos/${videoId}`).get();
    if (!snap.exists) throw new Error(`Video ${videoId} not found in channel ${formatEntry(channel)}`);
    if (touchesVideoDoc && !snap.data().isCustom) {
        throw new Error(`Video ${videoId} is a YouTube video — only its playlists can be changed, not its packaging`);
    }
    return snap.data();
}

function touchesVideoDoc(changes, options) {
    return Object.keys(changes).length > 0 || Boolean(options.thumbnail) || options['save-version'];
}

async function buildPlan(ctx, options) {
    const { db, builder } = ctx;
    const changes = readFieldChanges(options, builder.parseTagList);
    const touchesPlaylists = options.playlist || options['remove-playlist'];
    if (options.video && !touchesVideoDoc(changes, options) && !touchesPlaylists) {
        throw new Error('Nothing to update — pass at least one of --title, --description, --tags, --thumbnail, '
            + '--playlist, --remove-playlist, --save-version');
    }
    const cover = prepareCover(options.thumbnail, builder);
    const userId = await resolveUserId(db, options.user);
    const channel = await resolveChannel(db, userId, options);
    const existing = await loadExistingVideo(db, userId, channel, options.video, touchesVideoDoc(changes, options));
    const playlistPlan = await buildPlaylistPlan(ctx, channel, options, existing);
    return { options, userId, channel, cover, changes, existing, ...playlistPlan };
}

async function resolvePlaylists(db, channel, queries = []) {
    const playlistsPath = `${channel.ref.path}/playlists`;
    const playlists = [];
    for (const query of queries) playlists.push(await findByIdOrName(db, playlistsPath, query, 'playlist'));
    return playlists;
}

/** Resolve --playlist / --remove-playlist names and compute the membership change. */
async function buildPlaylistPlan({ db, builder }, channel, options, existing) {
    const toAddSnaps = await resolvePlaylists(db, channel, options.playlist);
    const toRemoveSnaps = await resolvePlaylists(db, channel, options['remove-playlist']);
    const currentSnaps = existing
        ? (await channel.ref.collection('playlists').where('videoIds', 'array-contains', options.video).get()).docs
        : [];
    const playlistsById = new Map([...currentSnaps, ...toAddSnaps, ...toRemoveSnaps].map((snap) => [snap.id, snap]));
    const membership = builder.planPlaylistMembership({
        currentPlaylistIds: currentSnaps.map((snap) => snap.id),
        requestedAddIds: toAddSnaps.map((snap) => snap.id),
        requestedRemoveIds: toRemoveSnaps.map((snap) => snap.id),
        isPlaylistOnly: Boolean(existing?.isPlaylistOnly),
    });
    return { playlistsById, membership };
}

/** New playlists get the video at the end; removals drop it. Each playlist in its own transaction. */
async function applyPlaylistChanges({ db, builder }, plan, videoId) {
    const { playlistsById, membership } = plan;
    for (const playlistId of membership.toAdd) {
        const playlist = playlistsById.get(playlistId);
        await updateIdListInDoc(db, playlist.ref, 'videoIds', (ids) => builder.appendUniqueId(ids, videoId), { updatedAt: Date.now() });
        console.log(`Added to the end of playlist "${docName(playlist)}"`);
    }
    for (const playlistId of membership.toRemove) {
        const playlist = playlistsById.get(playlistId);
        await removeVideoFromPlaylistDoc(db, playlist.ref, videoId);
        console.log(`Removed from playlist "${docName(playlist)}"`);
    }
}

async function main() {
    const options = readCliOptions();
    if (options.help) {
        console.log(HELP);
        return;
    }
    const builder = await loadSharedBuilder();
    const ctx = { ...initFirebase(), builder };

    if (options.list) {
        await printChannelsWithPlaylists(ctx.db, await resolveUserId(ctx.db, options.user), options.channel);
        return;
    }
    if (options.delete) {
        await runDelete(ctx, options);
        return;
    }

    validateOptions(options);
    const plan = await buildPlan(ctx, options);
    printPlan(plan);
    if (!options.execute) {
        console.log('Dry run only. Re-run with --execute to apply.');
        return;
    }

    const videoId = await applyVideoWrite(ctx, plan);
    await applyPlaylistChanges(ctx, plan, videoId);
    console.log(`\nDone. Video id: ${videoId}`);
}

main().catch((error) => {
    console.error('FAILED:', error.message);
    process.exit(1);
});
