# Admin CLI scripts

Node scripts that work directly with production Firebase (`mytube-46104`) via the admin SDK.
Run from the project root. Auth: Application Default Credentials
(`gcloud auth application-default login`); `firebase-admin` is resolved from `functions/`.

**Safety convention:** scripts that write are dry-run by default and only write with
`--execute` (newer) or `--write` (older). Always run the dry run first and read its plan.

## Content operations (for agents and humans)

| Script | What it does | Doc |
|---|---|---|
| `create-custom-video.mjs` | Prepare custom videos for publishing. `--list` shows channels and their playlists; default mode creates a video (cover, title, description, tags, playlist, optional v.1); `--video <id>` updates an existing one (only passed fields change, saved as draft or new version) and manages its playlists (`--playlist` adds to the end, `--remove-playlist` removes; repeatable, works for YouTube videos too); `--delete --video <id>` deletes a video with its files, history and playlist references. Big covers are downscaled automatically (macOS). Does not upload to YouTube. Needs `cd functions && npm run build` once. `--help` lists all flags. | [create-custom-video-cli.md](../docs/features/video-management/create-custom-video-cli.md) |
| `move-video-to-channel.mjs` | Move a video with all its history (snapshots, Storage files, order) to another internal channel. Needs `cd functions && npm run build` once. | [move-video-to-channel.md](../docs/features/video-management/move-video-to-channel.md) |

Examples:

```bash
# Which channels and playlists exist?
node scripts/create-custom-video.mjs --list                       # all channels with playlists
node scripts/create-custom-video.mjs --list --channel "slow life piano"

# Create a video in playlist "rainy" (channel found from the playlist), save as v.1
node scripts/create-custom-video.mjs --playlist "rainy" --title "Rainy night piano" \
  --description-file ./desc.txt --tags "piano,sleep,rain" --thumbnail ./cover.jpg \
  --save-version                               # dry run: prints the plan
# same command + --execute                     # creates the video, prints its id

# Update an existing video: new cover + title, saved as the next packaging version
node scripts/create-custom-video.mjs --video custom-1794245310631 \
  --thumbnail ./cover-v2.jpg --title "Rainy night piano II" --save-version --execute

# Move a video between playlists (added videos go to the END of a playlist)
node scripts/create-custom-video.mjs --video custom-1794245310631 \
  --playlist "cottage" --remove-playlist "Slow Life November" --execute

# Delete a video (dry run lists files, subcollections and playlists that will be cleaned up)
node scripts/create-custom-video.mjs --delete --video custom-1794245310631   # + --execute to delete
```

Channel and playlist accept an exact name (case-insensitive) or a document id; when not found,
the script lists the available ones. `--channel` may be omitted when `--playlist` or `--video`
identifies it. `--user` is auto-detected when the project has one user.

## Debugging (read-only)

| Script | What it does |
|---|---|
| `debug-video-full.mjs <videoId>` | Dump a video document with its subcollections |
| `debug-video-timestamps.mjs <videoId>` | Inspect snapshot/version timestamps of a video |
| `read-conversation.mjs <messagesPath>` | Print AI chat messages with tool call details |
| `audit-tokens.mjs <conversationPath>` | Token usage audit of an AI chat conversation |
| `measure-image-tokens.mjs` | Measure Gemini token cost of images (no generation calls) |

## One-time migrations / maintenance

| Script | What it does |
|---|---|
| `backfill-snapshot-timestamps.mjs [--write]` | Backfill last-upload timestamps on video docs |
| `migrate-ki-video-refs.mjs <basePath> [--write]` | Convert raw video ids in Knowledge Items to `vid://` links |
| `cleanup-checkin-notifications.mjs [--write]` | Delete check-in notifications so the scheduler recreates them |

## Tooling

| Script | What it does |
|---|---|
| `check-docs.mjs` | Validates links and file paths in `docs/features/` (part of `npm run check`) |
