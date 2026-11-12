import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useAuth } from '../../../core/hooks/useAuth';
import { useChannelStore } from '../../../core/stores/channelStore';
import { useUIStore } from '../../../core/stores/uiStore';
import { useSubniches } from '../../../core/hooks/useSubniches';
import type { Subniche } from '../../../core/types/subniche';
import { isSubnicheNameTaken } from '../../../core/utils/subnicheUtils';
import { formatViewCount } from '../../../core/utils/formatUtils';
import { logger } from '../../../core/utils/logger';
import { useResolvedReferences } from '../hooks/useResolvedReferences';

interface SubnicheManageRowProps {
    subniche: Subniche;
    subniches: Subniche[];
    videoCount: number;
    onRequestDelete: () => void;
}

export const SubnicheManageRow: React.FC<SubnicheManageRowProps> = ({ subniche, subniches, videoCount, onRequestDelete }) => {
    const { user } = useAuth();
    const { currentChannel } = useChannelStore();
    const { showToast } = useUIStore();
    const userId = user?.uid || '';
    const channelId = currentChannel?.id || '';
    const { renameSubniche, removeReference } = useSubniches(userId, channelId);
    const references = useResolvedReferences(userId, channelId, subniche);
    const [draftName, setDraftName] = useState(subniche.name);

    const commitRename = async () => {
        const name = draftName.trim();
        if (!name || name === subniche.name) {
            setDraftName(subniche.name);
            return;
        }
        if (isSubnicheNameTaken(subniches, name, subniche.id)) {
            showToast(`A subniche named "${name}" already exists`, 'error');
            setDraftName(subniche.name);
            return;
        }
        try {
            await renameSubniche({ subnicheId: subniche.id, name });
        } catch (error: unknown) {
            logger.error('Failed to rename subniche', { component: 'SubnicheManageRow', subnicheId: subniche.id, error });
            showToast('Could not rename subniche', 'error');
            setDraftName(subniche.name);
        }
    };

    const handleRemoveReference = async (videoId: string) => {
        try {
            await removeReference({ subnicheId: subniche.id, videoId });
        } catch (error: unknown) {
            logger.error('Failed to remove subniche reference', { component: 'SubnicheManageRow', subnicheId: subniche.id, videoId, error });
            showToast('Could not remove reference', 'error');
        }
    };

    return (
        <div className="rounded-lg border border-border p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setDraftName(subniche.name);
                    }}
                    className="flex-1 min-w-0 bg-transparent text-text-primary text-sm font-medium px-2 py-1 rounded-md border border-transparent hover:border-border focus:border-border focus:outline-none"
                    aria-label="Subniche name"
                />
                <span className="text-xs text-text-tertiary flex-shrink-0">
                    {videoCount} {videoCount === 1 ? 'video' : 'videos'} · {references.length} {references.length === 1 ? 'reference' : 'references'}
                </span>
                <button
                    onClick={onRequestDelete}
                    className="p-1.5 rounded-full bg-transparent border-none cursor-pointer text-text-secondary hover:text-red-500 hover:bg-red-500/10 flex-shrink-0"
                    title="Delete subniche"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {references.length === 0 ? (
                <p className="text-xs text-text-tertiary m-0 px-2">No references yet — add them from Trends.</p>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    {references.map(reference => (
                        <div key={reference.videoId} className="relative group">
                            <img src={reference.thumbnail} alt={reference.title} className="w-full aspect-video object-cover rounded-md bg-bg-tertiary" />
                            <span className="absolute bottom-1 left-1 px-1 rounded bg-black/70 text-white text-[10px]">
                                {formatViewCount(reference.viewCount)}
                            </span>
                            <button
                                onClick={() => handleRemoveReference(reference.videoId)}
                                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove reference"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
