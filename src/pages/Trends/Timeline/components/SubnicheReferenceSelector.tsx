import React, { useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { FloatingDropdownPortal } from '../../../../components/ui/atoms/FloatingDropdownPortal';
import { useAuth } from '../../../../core/hooks/useAuth';
import { useChannelStore } from '../../../../core/stores/channelStore';
import { useUIStore } from '../../../../core/stores/uiStore';
import { useSubniches } from '../../../../core/hooks/useSubniches';
import { buildReferenceFromTrendVideo } from '../../../../core/utils/subnicheUtils';
import type { Subniche } from '../../../../core/types/subniche';
import type { TrendVideo } from '../../../../core/types/trends';
import { SubnicheSearchList } from '../../../../features/Subniches/components/SubnicheSearchList';
import { logger } from '../../../../core/utils/logger';

interface SubnicheReferenceSelectorProps {
    videos: TrendVideo[];
    isOpen: boolean;
    openAbove: boolean;
    onToggle: () => void;
}

/** Floating-bar action: use the selected Trends videos as visual references of a subniche (toggle). */
export const SubnicheReferenceSelector: React.FC<SubnicheReferenceSelectorProps> = ({ videos, isOpen, openAbove, onToggle }) => {
    const { user } = useAuth();
    const { currentChannel } = useChannelStore();
    const { showToast } = useUIStore();
    const { subniches, createSubniche, addReferences, removeReference } = useSubniches(user?.uid || '', currentChannel?.id || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const referenceLabel = videos.length > 1 ? `${videos.length} references` : 'Reference';
    const isEveryVideoReferenced = (subniche: Subniche) =>
        videos.every(video => subniche.references.some(r => r.videoId === video.id));

    const runAction = async (action: () => Promise<void>, failureMessage: string) => {
        setIsProcessing(true);
        try {
            await action();
        } catch (error: unknown) {
            logger.error('Subniche reference update failed', { component: 'SubnicheReferenceSelector', error });
            showToast(failureMessage, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelect = (subniche: Subniche) => runAction(async () => {
        if (isEveryVideoReferenced(subniche)) {
            await Promise.all(videos.map(video => removeReference({ subnicheId: subniche.id, videoId: video.id })));
            showToast(`${referenceLabel} removed from "${subniche.name}"`, 'success');
            return;
        }
        const now = Date.now();
        await addReferences({ subnicheId: subniche.id, references: videos.map(video => buildReferenceFromTrendVideo(video, now)) });
        showToast(`${referenceLabel} added to "${subniche.name}"`, 'success');
    }, 'Could not update subniche references');

    const handleCreate = (name: string) => runAction(async () => {
        const now = Date.now();
        await createSubniche({ name, references: videos.map(video => buildReferenceFromTrendVideo(video, now)) });
        showToast(`Created subniche "${name}"`, 'success');
        onToggle();
    }, 'Could not create subniche');

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onToggle}
                disabled={isProcessing}
                className={`p-1.5 rounded-full transition-colors ${isOpen ? 'bg-text-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary hover:bg-overlay/10'} ${isProcessing ? 'opacity-50' : ''}`}
                title="Use as subniche visual reference"
            >
                <Layers size={16} />
            </button>

            <FloatingDropdownPortal
                isOpen={isOpen}
                anchorRect={buttonRef.current?.getBoundingClientRect() || null}
                openAbove={openAbove}
                width={256}
            >
                <SubnicheSearchList
                    subniches={subniches}
                    isChecked={isEveryVideoReferenced}
                    onSelect={handleSelect}
                    onCreate={handleCreate}
                    isDisabled={isProcessing}
                />
            </FloatingDropdownPortal>
        </div>
    );
};
