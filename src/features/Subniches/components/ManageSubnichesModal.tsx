import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers, X } from 'lucide-react';
import { useAuth } from '../../../core/hooks/useAuth';
import { useChannelStore } from '../../../core/stores/channelStore';
import { useUIStore } from '../../../core/stores/uiStore';
import { useSubniches } from '../../../core/hooks/useSubniches';
import { useVideos } from '../../../core/hooks/useVideos';
import { ConfirmationModal } from '../../../components/ui/organisms/ConfirmationModal';
import type { Subniche } from '../../../core/types/subniche';
import { logger } from '../../../core/utils/logger';
import { SubnicheManageRow } from './SubnicheManageRow';

interface ManageSubnichesModalProps {
    onClose: () => void;
}

/** Rename / delete subniches and prune their references. */
export const ManageSubnichesModal: React.FC<ManageSubnichesModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const { currentChannel } = useChannelStore();
    const { showToast } = useUIStore();
    const userId = user?.uid || '';
    const channelId = currentChannel?.id || '';
    const { subniches, deleteSubniche } = useSubniches(userId, channelId);
    const { videos } = useVideos(userId, channelId);
    const [pendingDelete, setPendingDelete] = useState<Subniche | null>(null);

    // Escape closes the modal (the delete confirmation handles its own Escape)
    useEffect(() => {
        if (pendingDelete) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, pendingDelete]);

    const videoCountBySubniche = useMemo(() => {
        const counts = new Map<string, number>();
        for (const video of videos) {
            if (video.subnicheId) counts.set(video.subnicheId, (counts.get(video.subnicheId) ?? 0) + 1);
        }
        return counts;
    }, [videos]);

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const { id, name } = pendingDelete;
        setPendingDelete(null);
        try {
            await deleteSubniche(id);
            showToast(`Deleted subniche "${name}"`, 'success');
        } catch (error: unknown) {
            logger.error('Failed to delete subniche', { component: 'ManageSubnichesModal', subnicheId: id, error });
            showToast('Could not delete subniche', 'error');
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-bg-secondary rounded-xl w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden animate-scale-in border border-border shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 flex items-center justify-between border-b border-border">
                    <h2 className="text-xl font-bold text-text-primary m-0 flex items-center gap-2"><Layers size={20} /> Subniches</h2>
                    <button onClick={onClose} className="p-1 rounded-full bg-transparent border-none cursor-pointer text-text-secondary hover:text-text-primary hover:bg-hover-bg" title="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                    {subniches.length === 0 && (
                        <p className="text-sm text-text-secondary text-center py-6 m-0">
                            No subniches yet. In Trends, select videos and use “Use as subniche visual reference”.
                        </p>
                    )}
                    {subniches.map(subniche => (
                        <SubnicheManageRow
                            key={subniche.id}
                            subniche={subniche}
                            subniches={subniches}
                            videoCount={videoCountBySubniche.get(subniche.id) ?? 0}
                            onRequestDelete={() => setPendingDelete(subniche)}
                        />
                    ))}
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!pendingDelete}
                onClose={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
                title="Delete Subniche"
                message={`Delete "${pendingDelete?.name}"? Its videos stay, they just won't have a subniche.`}
                confirmLabel="Delete"
                confirmVariant="danger"
            />
        </div>,
        document.body
    );
};
