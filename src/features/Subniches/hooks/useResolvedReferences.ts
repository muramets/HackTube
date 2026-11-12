import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SubnicheService } from '../../../core/services/subnicheService';
import { resolveReferences } from '../../../../shared/subniche';
import type { ResolvedSubnicheReference, Subniche } from '../../../core/types/subniche';

/** View counts change at most once per Trends sync — no need to refetch more often. */
const REFERENCE_STALE_TIME_MS = 10 * 60 * 1000;
const EMPTY_RESOLVED: ResolvedSubnicheReference[] = [];

/** A subniche's references with live Trends data (snapshot fallback while loading or when gone). */
export const useResolvedReferences = (userId: string, channelId: string, subniche: Subniche | undefined) => {
    const references = subniche?.references;
    const referenceKey = useMemo(() => (references ?? []).map(r => r.videoId).join(','), [references]);

    const { data: liveVideosById } = useQuery({
        queryKey: ['subnicheReferences', userId, channelId, subniche?.id, referenceKey],
        queryFn: () => SubnicheService.fetchReferenceVideos(userId, channelId, references ?? []),
        staleTime: REFERENCE_STALE_TIME_MS,
        enabled: !!userId && !!channelId && !!references?.length,
    });

    return useMemo(() => {
        if (!references?.length) return EMPTY_RESOLVED;
        return resolveReferences(references, liveVideosById ?? new Map());
    }, [references, liveVideosById]);
};
