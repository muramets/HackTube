/**
 * Subniche — a proven visual formula for covers, backed by competitor reference videos from Trends.
 * Stored per user channel: users/{uid}/channels/{ch}/subniches/{id}.
 * Reference types and logic live in shared/subniche.ts (shared with the admin CLI).
 * Doc: docs/features/video-management/subniches.md
 */
import type { SubnicheReference } from '../../../shared/subniche';

export type {
    SubnicheReference,
    SubnicheReferenceSnapshot,
    ResolvedSubnicheReference,
} from '../../../shared/subniche';

export interface Subniche {
    id: string;
    name: string;
    references: SubnicheReference[];
    createdAt: number;
    updatedAt: number;
}
