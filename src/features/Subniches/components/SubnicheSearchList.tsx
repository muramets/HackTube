import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Layers, Plus } from 'lucide-react';
import type { Subniche } from '../../../core/types/subniche';
import { isSubnicheNameTaken } from '../../../core/utils/subnicheUtils';
import { useKeyboardNavigation } from '../../../core/hooks/useKeyboardNavigation';

interface SubnicheSearchListProps {
    subniches: Subniche[];
    isChecked: (subniche: Subniche) => boolean;
    onSelect: (subniche: Subniche) => void;
    /** Enter on a name that matches no subniche creates one. */
    onCreate: (name: string) => void;
    /** Optional footer, e.g. "Manage subniches…". */
    footer?: React.ReactNode;
    isDisabled?: boolean;
}

function matchesSearch(name: string, search: string): boolean {
    const terms = search.toLowerCase().trim().split(/\s+/);
    const nameLower = name.toLowerCase();
    return terms.every(term => nameLower.includes(term));
}

/** Search box + subniche list; typing a new name and pressing Enter creates it. */
export const SubnicheSearchList: React.FC<SubnicheSearchListProps> = ({ subniches, isChecked, onSelect, onCreate, footer, isDisabled }) => {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const visibleSubniches = useMemo(
        () => (search.trim() ? subniches.filter(s => matchesSearch(s.name, search)) : subniches),
        [subniches, search],
    );
    const canCreate = search.trim().length > 0 && !isSubnicheNameTaken(subniches, search);

    const { activeIndex, handleKeyDown } = useKeyboardNavigation({
        listLength: visibleSubniches.length,
        onEnter: (index) => onSelect(visibleSubniches[index]),
    });

    useEffect(() => {
        if (activeIndex < 0 || !listRef.current) return;
        (listRef.current.children[activeIndex] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeIndex >= 0 || !canCreate || isDisabled) return;
        onCreate(search.trim());
        setSearch('');
    };

    return (
        <div data-portal-wrapper className="flex flex-col h-full min-h-0">
            <div className="p-2 border-b border-overlay/10 bg-overlay/5">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search or create subniche..."
                        className="w-full bg-bg-primary text-text-primary text-xs px-3 py-2 pl-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-overlay/20 placeholder:text-text-secondary"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isDisabled}
                    />
                    <Plus size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                </form>
            </div>
            <div ref={listRef} className="overflow-y-auto custom-scrollbar p-1 flex-1">
                {visibleSubniches.map((subniche, index) => {
                    const checked = isChecked(subniche);
                    return (
                        <button
                            key={subniche.id}
                            onClick={() => onSelect(subniche)}
                            disabled={isDisabled}
                            className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors justify-between border-none cursor-pointer bg-transparent ${checked ? 'text-text-primary' : 'text-text-secondary'} ${activeIndex === index ? 'bg-overlay/10 text-text-primary' : 'hover:bg-overlay/5 hover:text-text-primary'}`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Layers size={14} className="flex-shrink-0" />
                                <span className="truncate">{subniche.name}</span>
                                <span className="text-text-tertiary flex-shrink-0">{subniche.references.length}</span>
                            </div>
                            {checked && <Check size={12} className="text-green-400 flex-shrink-0" />}
                        </button>
                    );
                })}
                {visibleSubniches.length === 0 && !canCreate && (
                    <div className="text-center py-3 text-xs text-text-tertiary">No subniches yet</div>
                )}
                {canCreate && (
                    <div className="text-center py-3 text-xs text-text-tertiary">Press Enter to create "{search.trim()}"</div>
                )}
            </div>
            {footer && <div className="border-t border-overlay/10 p-1">{footer}</div>}
        </div>
    );
};
