import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useAuth } from '../../../core/hooks/useAuth';
import { useChannelStore } from '../../../core/stores/channelStore';
import { useSettings } from '../../../core/hooks/useSettings';
import { useVideoPlayer } from '../../../core/hooks/useVideoPlayer';
import { pickTopReferences } from '../../../core/utils/subnicheUtils';
import { formatViewCount } from '../../../core/utils/formatUtils';
import type { ResolvedSubnicheReference, Subniche } from '../../../core/types/subniche';
import { GRID_LAYOUT } from '../../Video/layout';
import { useResolvedReferences } from '../hooks/useResolvedReferences';

interface SubnicheReferenceStripProps {
    subniche: Subniche;
}

const ReferenceCard: React.FC<{ reference: ResolvedSubnicheReference }> = ({ reference }) => {
    const { minimize } = useVideoPlayer();
    return (
        <button
            onClick={() => minimize(reference.videoId, reference.title)}
            className="flex flex-col gap-2 p-[6px] rounded-xl text-left bg-transparent border-none cursor-pointer hover:bg-hover-bg transition-colors min-w-0"
            title="Play reference"
        >
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-bg-tertiary">
                <img src={reference.thumbnail} alt={reference.title} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-semibold uppercase tracking-wide">
                    <Layers size={10} /> Reference
                </span>
            </div>
            <div className="min-w-0 px-1">
                <p className="text-sm font-medium text-text-primary m-0 line-clamp-2">{reference.title}</p>
                <p className="text-xs text-text-secondary m-0 mt-1 truncate">{reference.channelTitle}</p>
                <p className="text-xs text-text-secondary m-0">{formatViewCount(reference.viewCount)} views</p>
            </div>
        </button>
    );
};

/** Top references of a subniche, pinned above the playlist grid (columns match the grid). */
export const SubnicheReferenceStrip: React.FC<SubnicheReferenceStripProps> = ({ subniche }) => {
    const { user } = useAuth();
    const { currentChannel } = useChannelStore();
    const { generalSettings } = useSettings();
    const resolved = useResolvedReferences(user?.uid || '', currentChannel?.id || '', subniche);
    const topReferences = useMemo(() => pickTopReferences(resolved), [resolved]);

    return (
        <div
            className="sticky top-0 z-sticky bg-bg-primary border-b border-border overflow-hidden"
            style={{ scrollbarGutter: 'stable', paddingTop: GRID_LAYOUT.PADDING.TOP / 2, paddingBottom: GRID_LAYOUT.PADDING.TOP / 2 }}
        >
            {topReferences.length === 0 ? (
                <p className="text-sm text-text-secondary m-0 px-6 py-3">
                    “{subniche.name}” has no references yet — add them in Trends with “Use as subniche visual reference”.
                </p>
            ) : (
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `repeat(${generalSettings.cardsPerRow}, minmax(0, 1fr))`,
                        gap: GRID_LAYOUT.GAP,
                        paddingLeft: GRID_LAYOUT.PADDING.LEFT,
                        paddingRight: GRID_LAYOUT.PADDING.RIGHT,
                    }}
                >
                    {topReferences.map(reference => <ReferenceCard key={reference.videoId} reference={reference} />)}
                </div>
            )}
        </div>
    );
};
