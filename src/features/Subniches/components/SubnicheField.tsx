import React, { useState } from 'react';
import { ChevronDown, Layers, Settings2 } from 'lucide-react';
import { Dropdown } from '../../../components/ui/molecules/Dropdown';
import { useAuth } from '../../../core/hooks/useAuth';
import { useChannelStore } from '../../../core/stores/channelStore';
import { useUIStore } from '../../../core/stores/uiStore';
import { useSubniches } from '../../../core/hooks/useSubniches';
import type { Subniche } from '../../../core/types/subniche';
import { logger } from '../../../core/utils/logger';
import { SubnicheSearchList } from './SubnicheSearchList';
import { ManageSubnichesModal } from './ManageSubnichesModal';

const DROPDOWN_WIDTH = 256;

interface SubnicheFieldProps {
    videoId: string;
    subnicheId?: string;
}

/** Details sidebar: pick the video's subniche. Saved immediately — not part of packaging versions. */
export const SubnicheField: React.FC<SubnicheFieldProps> = ({ videoId, subnicheId }) => {
    const { user } = useAuth();
    const { currentChannel } = useChannelStore();
    const { showToast } = useUIStore();
    const { subniches, createSubniche, setVideoSubniche } = useSubniches(user?.uid || '', currentChannel?.id || '');
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [isManageOpen, setIsManageOpen] = useState(false);

    const current = subniches.find(s => s.id === subnicheId);
    const closeDropdown = () => setAnchorEl(null);

    const assign = async (nextSubnicheId: string | null) => {
        try {
            await setVideoSubniche({ videoId, subnicheId: nextSubnicheId });
        } catch (error: unknown) {
            logger.error('Failed to set video subniche', { component: 'SubnicheField', videoId, error });
            showToast('Could not update subniche', 'error');
        }
    };

    const handleSelect = (subniche: Subniche) => {
        closeDropdown();
        void assign(subniche.id === subnicheId ? null : subniche.id);
    };

    const handleCreate = async (name: string) => {
        closeDropdown();
        try {
            const newId = await createSubniche({ name });
            await assign(newId);
        } catch (error: unknown) {
            logger.error('Failed to create subniche', { component: 'SubnicheField', error });
            showToast('Could not create subniche', 'error');
        }
    };

    return (
        <div className="px-[15px] pb-3">
            <button
                onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent hover:bg-hover-bg border border-border text-sm cursor-pointer transition-colors"
                title="Visual subniche of this video"
            >
                <Layers size={16} className="text-text-secondary flex-shrink-0" />
                <span className="text-text-secondary flex-shrink-0">Subniche</span>
                <span className={`truncate flex-1 text-right ${current ? 'text-text-primary' : 'text-text-tertiary'}`}>
                    {current?.name ?? 'None'}
                </span>
                <ChevronDown size={14} className="text-text-secondary flex-shrink-0" />
            </button>

            <Dropdown isOpen={!!anchorEl} onClose={closeDropdown} anchorEl={anchorEl} width={DROPDOWN_WIDTH} align="left">
                <div className="max-h-[320px] flex flex-col">
                    <SubnicheSearchList
                        subniches={subniches}
                        isChecked={(subniche) => subniche.id === subnicheId}
                        onSelect={handleSelect}
                        onCreate={handleCreate}
                        footer={(
                            <button
                                onClick={() => {
                                    closeDropdown();
                                    setIsManageOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 text-text-secondary hover:text-text-primary hover:bg-overlay/5 bg-transparent border-none cursor-pointer"
                            >
                                <Settings2 size={14} />
                                Manage subniches…
                            </button>
                        )}
                    />
                </div>
            </Dropdown>

            {isManageOpen && <ManageSubnichesModal onClose={() => setIsManageOpen(false)} />}
        </div>
    );
};
