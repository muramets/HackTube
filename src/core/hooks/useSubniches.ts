import { useQuery, useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SubnicheService } from '../services/subnicheService';
import type { Subniche, SubnicheReference } from '../types/subniche';

const EMPTY_SUBNICHES: Subniche[] = [];

/** Subniches of the current user channel. The live subscription lives in useFirestoreSync. */
export const useSubniches = (userId: string, channelId: string) => {
    const queryKey = useMemo(() => ['subniches', userId, channelId], [userId, channelId]);

    const { data, isLoading } = useQuery<Subniche[]>({
        queryKey,
        queryFn: () => SubnicheService.fetchSubniches(userId, channelId),
        staleTime: Infinity,
        enabled: !!userId && !!channelId,
    });

    const createSubniche = useMutation({
        mutationFn: ({ name, references }: { name: string; references?: SubnicheReference[] }) =>
            SubnicheService.createSubniche(userId, channelId, name, references),
    });
    const renameSubniche = useMutation({
        mutationFn: ({ subnicheId, name }: { subnicheId: string; name: string }) =>
            SubnicheService.renameSubniche(userId, channelId, subnicheId, name),
    });
    const deleteSubniche = useMutation({
        mutationFn: (subnicheId: string) => SubnicheService.deleteSubniche(userId, channelId, subnicheId),
    });
    const addReferences = useMutation({
        mutationFn: ({ subnicheId, references }: { subnicheId: string; references: SubnicheReference[] }) =>
            SubnicheService.addReferences(userId, channelId, subnicheId, references),
    });
    const removeReference = useMutation({
        mutationFn: ({ subnicheId, videoId }: { subnicheId: string; videoId: string }) =>
            SubnicheService.removeReference(userId, channelId, subnicheId, videoId),
    });
    const setVideoSubniche = useMutation({
        mutationFn: ({ videoId, subnicheId }: { videoId: string; subnicheId: string | null }) =>
            SubnicheService.setVideoSubniche(userId, channelId, videoId, subnicheId),
    });

    return useMemo(() => ({
        subniches: data ?? EMPTY_SUBNICHES,
        isLoading,
        createSubniche: createSubniche.mutateAsync,
        renameSubniche: renameSubniche.mutateAsync,
        deleteSubniche: deleteSubniche.mutateAsync,
        addReferences: addReferences.mutateAsync,
        removeReference: removeReference.mutateAsync,
        setVideoSubniche: setVideoSubniche.mutateAsync,
    }), [data, isLoading, createSubniche.mutateAsync, renameSubniche.mutateAsync, deleteSubniche.mutateAsync,
        addReferences.mutateAsync, removeReference.mutateAsync, setVideoSubniche.mutateAsync]);
};
