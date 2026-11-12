import { describe, it, expect } from 'vitest';
import {
    DEPRIORITIZED_FADE,
    areAllDeprioritized,
    buildPlaylistFadeMap,
    combineFadeStyles,
    countDeprioritizedInPlaylist,
    mergeVisibleReorder,
} from '../deprioritizedVideos';

const FRESH_HALF = { opacity: 0.6, saturate: 0.5 };

describe('combineFadeStyles', () => {
    it('returns the only style present', () => {
        expect(combineFadeStyles(undefined, FRESH_HALF)).toBe(FRESH_HALF);
        expect(combineFadeStyles(FRESH_HALF, undefined)).toBe(FRESH_HALF);
        expect(combineFadeStyles()).toBeUndefined();
    });

    it('takes the stronger fade per channel instead of stacking', () => {
        expect(combineFadeStyles({ opacity: 0.3, saturate: 0.9 }, { opacity: 0.8, saturate: 0.2 }))
            .toEqual({ opacity: 0.3, saturate: 0.2 });
    });
});

describe('buildPlaylistFadeMap', () => {
    it('returns undefined when nothing is faded', () => {
        expect(buildPlaylistFadeMap(['a'], undefined, new Set())).toBeUndefined();
    });

    it('dims only deprioritized videos', () => {
        const map = buildPlaylistFadeMap(['a', 'b'], undefined, new Set(['b']));
        expect(map?.get('a')).toBeUndefined();
        expect(map?.get('b')).toEqual(DEPRIORITIZED_FADE);
    });

    it('merges with freshness, keeping the stronger fade', () => {
        const freshness = new Map([['a', FRESH_HALF], ['b', { opacity: 0.1, saturate: 0.1 }]]);
        const map = buildPlaylistFadeMap(['a', 'b'], freshness, new Set(['a', 'b']));
        expect(map?.get('a')).toEqual(DEPRIORITIZED_FADE);
        expect(map?.get('b')).toEqual({ opacity: 0.1, saturate: 0.1 });
    });
});

describe('areAllDeprioritized', () => {
    const dimmed = new Set(['a', 'b']);

    it('is true only when every selected video is dimmed', () => {
        expect(areAllDeprioritized(['a', 'b'], dimmed)).toBe(true);
        expect(areAllDeprioritized(['a', 'c'], dimmed)).toBe(false);
    });

    it('is false for an empty selection', () => {
        expect(areAllDeprioritized([], dimmed)).toBe(false);
    });

    it('accepts a Set selection', () => {
        expect(areAllDeprioritized(new Set(['a']), dimmed)).toBe(true);
    });
});

describe('countDeprioritizedInPlaylist', () => {
    it('ignores stale ids no longer in the playlist', () => {
        expect(countDeprioritizedInPlaylist(['a', 'b'], new Set(['b', 'gone']))).toBe(1);
    });
});

describe('mergeVisibleReorder', () => {
    it('keeps hidden videos in their slots', () => {
        // b and d are hidden; visible a,c,e reordered to e,a,c
        expect(mergeVisibleReorder(['a', 'b', 'c', 'd', 'e'], ['e', 'a', 'c'])).toEqual(['e', 'b', 'a', 'd', 'c']);
    });

    it('is the plain reorder when nothing is hidden', () => {
        expect(mergeVisibleReorder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
    });

    it('never loses ids', () => {
        const full = ['a', 'b', 'c', 'd'];
        expect([...mergeVisibleReorder(full, ['d', 'a'])].sort()).toEqual(full);
    });
});
