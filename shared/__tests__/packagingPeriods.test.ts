import { describe, it, expect } from 'vitest';
import { addNewActivePeriod, closeAllPeriods, ensureActivePeriods, type VersionWithPeriods } from '../packagingPeriods';

const T1 = 1_000;
const T2 = 2_000;
const T3 = 3_000;

describe('ensureActivePeriods', () => {
    it('synthesizes one period for legacy versions without periods', () => {
        const legacy: VersionWithPeriods = { startDate: T1, endDate: T2 };
        expect(ensureActivePeriods(legacy).activePeriods).toEqual([{ startDate: T1, endDate: T2, closingSnapshotId: null }]);
    });

    it('treats a missing endDate as still open', () => {
        const legacy: VersionWithPeriods = { startDate: T1 };
        const result = ensureActivePeriods(legacy);
        expect(result.endDate).toBeNull();
        expect(result.activePeriods[0].endDate).toBeNull();
    });

    it('keeps existing periods', () => {
        const periods = [{ startDate: T2, endDate: null, closingSnapshotId: null }];
        expect(ensureActivePeriods({ startDate: T1, endDate: null, activePeriods: periods }).activePeriods).toEqual(periods);
    });
});

describe('closeAllPeriods', () => {
    it('closes the open period with the given snapshot id', () => {
        const live: VersionWithPeriods = { startDate: T1, endDate: null, activePeriods: [{ startDate: T1, endDate: null, closingSnapshotId: null }] };
        const closed = closeAllPeriods(live, 'snap-1', T2);
        expect(closed.endDate).toBe(T2);
        expect(closed.activePeriods).toEqual([{ startDate: T1, endDate: T2, closingSnapshotId: 'snap-1' }]);
    });

    it('leaves already-closed versions untouched', () => {
        const done: VersionWithPeriods = { startDate: T1, endDate: T2, activePeriods: [{ startDate: T1, endDate: T2, closingSnapshotId: null }] };
        expect(closeAllPeriods(done, null, T3)).toEqual({ ...done, endDate: T2 });
    });

    it('preserves extra fields of the version', () => {
        const live = { startDate: T1, endDate: null, versionNumber: 4 };
        expect(closeAllPeriods(live, null, T2).versionNumber).toBe(4);
    });
});

describe('addNewActivePeriod', () => {
    it('opens a new period in front and restarts the version', () => {
        const closed: VersionWithPeriods = { startDate: T1, endDate: T2, activePeriods: [{ startDate: T1, endDate: T2, closingSnapshotId: null }] };
        const reopened = addNewActivePeriod(closed, T3);
        expect(reopened).toMatchObject({ startDate: T3, endDate: null });
        expect(reopened.activePeriods).toEqual([
            { startDate: T3, endDate: null, closingSnapshotId: null },
            { startDate: T1, endDate: T2, closingSnapshotId: null },
        ]);
    });
});
