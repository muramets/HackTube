// =============================================================================
// shared/packagingPeriods.ts — Active-period rules for packaging versions
//
// Zero dependencies. Zero I/O. Zero framework imports.
// Single source of truth for "when was this packaging version live":
// used by the Packaging tab (via VersionService) and by the CLI
// (`scripts/create-custom-video.mjs`).
//
// A version can be activated several times (restore), so it keeps a list of
// periods, newest first. At most one period is open (endDate === null).
// =============================================================================

export interface PackagingActivePeriod {
    startDate: number;
    endDate: number | null;
    closingSnapshotId: string | null;
}

/** Minimal shape of a packaging version these rules operate on. */
export interface VersionWithPeriods {
    startDate: number;
    endDate?: number | null;
    activePeriods?: PackagingActivePeriod[];
}

const isOpen = (endDate: number | null | undefined): boolean => endDate === null || endDate === undefined;

/**
 * Normalize a version so it always has a periods list.
 * Legacy versions without periods get one synthesized from startDate/endDate.
 */
export function ensureActivePeriods<T extends VersionWithPeriods>(version: T): T & { activePeriods: PackagingActivePeriod[] } {
    const rawPeriods: PackagingActivePeriod[] = version.activePeriods && version.activePeriods.length > 0
        ? version.activePeriods
        : [{ startDate: version.startDate, endDate: version.endDate ?? null, closingSnapshotId: null }];

    const activePeriods = rawPeriods.map(period => ({
        ...period,
        endDate: period.endDate ?? null,
        closingSnapshotId: period.closingSnapshotId ?? null,
    }));

    return { ...version, endDate: version.endDate ?? null, activePeriods };
}

/** Close every open period of a version (it stops being live at `now`). */
export function closeAllPeriods<T extends VersionWithPeriods>(
    version: T,
    closingSnapshotId?: string | null,
    now: number = Date.now(),
): T & { activePeriods: PackagingActivePeriod[] } {
    const withPeriods = ensureActivePeriods(version);
    if (!withPeriods.activePeriods.some(period => isOpen(period.endDate))) return withPeriods;

    const activePeriods = withPeriods.activePeriods.map(period => isOpen(period.endDate)
        ? { ...period, endDate: now, closingSnapshotId: closingSnapshotId || null }
        : period);

    return { ...withPeriods, endDate: now, activePeriods };
}

/** Open a new period at the front of the list (the version becomes live at `now`). */
export function addNewActivePeriod<T extends VersionWithPeriods>(
    version: T,
    now: number = Date.now(),
): T & { activePeriods: PackagingActivePeriod[] } {
    const withPeriods = ensureActivePeriods(version);
    const newPeriod: PackagingActivePeriod = { startDate: now, endDate: null, closingSnapshotId: null };
    return { ...withPeriods, startDate: now, endDate: null, activePeriods: [newPeriod, ...withPeriods.activePeriods] };
}
