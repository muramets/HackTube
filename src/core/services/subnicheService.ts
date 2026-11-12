import { orderBy, doc, runTransaction, collection, query, where, getDocs, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { subscribeToCollection, setDocument, updateDocument, fetchCollection, fetchDoc } from './firestore';
import type { TrendVideo } from '../types/trends';
import type { Subniche, SubnicheReference } from '../types/subniche';
import { mergeReferences } from '../../../shared/subniche';

const SUBNICHE_ID_PREFIX = 'subniche-';

const getSubnichesPath = (userId: string, channelId: string) =>
    `users/${userId}/channels/${channelId}/subniches`;

const getVideosPath = (userId: string, channelId: string) =>
    `users/${userId}/channels/${channelId}/videos`;

export const SubnicheService = {
    fetchSubniches: (userId: string, channelId: string) =>
        fetchCollection<Subniche>(getSubnichesPath(userId, channelId), [orderBy('createdAt')]),

    /** Live Trends docs of the references (missing ones are skipped — callers fall back to snapshots). */
    fetchReferenceVideos: async (userId: string, channelId: string, references: SubnicheReference[]) => {
        const videos = await Promise.all(references.map(r =>
            fetchDoc<TrendVideo>(`users/${userId}/channels/${channelId}/trendChannels/${r.trendChannelId}/videos`, r.videoId)));
        const liveVideosById = new Map<string, TrendVideo>();
        videos.forEach((video, i) => {
            if (video) liveVideosById.set(references[i].videoId, video);
        });
        return liveVideosById;
    },

    subscribeToSubniches: (userId: string, channelId: string, callback: (subniches: Subniche[]) => void) =>
        subscribeToCollection<Subniche>(getSubnichesPath(userId, channelId), callback, [orderBy('createdAt')]),

    createSubniche: async (userId: string, channelId: string, name: string, references: SubnicheReference[] = []) => {
        const now = Date.now();
        const subniche: Subniche = { id: `${SUBNICHE_ID_PREFIX}${now}`, name: name.trim(), references, createdAt: now, updatedAt: now };
        await setDocument(getSubnichesPath(userId, channelId), subniche.id, subniche);
        return subniche.id;
    },

    renameSubniche: async (userId: string, channelId: string, subnicheId: string, name: string) => {
        await updateDocument(getSubnichesPath(userId, channelId), subnicheId, { name: name.trim(), updatedAt: Date.now() });
    },

    /** Add references in a transaction — a reference already present is kept as is. */
    addReferences: async (userId: string, channelId: string, subnicheId: string, references: SubnicheReference[]) => {
        const ref = doc(db, getSubnichesPath(userId, channelId), subnicheId);
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) throw new Error(`Subniche ${subnicheId} not found`);
            const current = (snap.data() as Subniche).references ?? [];
            tx.update(ref, { references: mergeReferences(current, references), updatedAt: Date.now() });
        });
    },

    removeReference: async (userId: string, channelId: string, subnicheId: string, videoId: string) => {
        const ref = doc(db, getSubnichesPath(userId, channelId), subnicheId);
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const current = (snap.data() as Subniche).references ?? [];
            tx.update(ref, { references: current.filter(r => r.videoId !== videoId), updatedAt: Date.now() });
        });
    },

    /** Delete the subniche and unassign it from every video that used it. */
    deleteSubniche: async (userId: string, channelId: string, subnicheId: string) => {
        const assigned = await getDocs(query(collection(db, getVideosPath(userId, channelId)), where('subnicheId', '==', subnicheId)));
        const batch = writeBatch(db);
        assigned.docs.forEach(videoDoc => batch.update(videoDoc.ref, { subnicheId: deleteField() }));
        batch.delete(doc(db, getSubnichesPath(userId, channelId), subnicheId));
        await batch.commit();
    },

    /** Assign a video to a subniche, or clear it with null. Not part of packaging versions. */
    setVideoSubniche: async (userId: string, channelId: string, videoId: string, subnicheId: string | null) => {
        await updateDocument(getVideosPath(userId, channelId), videoId, { subnicheId: subnicheId ?? deleteField() });
    },
};
