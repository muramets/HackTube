import React, { useState } from 'react';
import { Search, Check } from 'lucide-react';

interface FilterOption {
    id: string;
    label: string;
    description?: string; // e.g. video count
}

interface FilterInputListProps {
    options: FilterOption[];
    onApply: (selectedIds: string[]) => void;
    placeholder?: string;
    multiSelect?: boolean;
}

export const FilterInputList: React.FC<FilterInputListProps> = ({
    options,
    onApply,
    placeholder = "Search",
    multiSelect = true
}) => {
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const toggleSelection = (id: string) => {
        if (multiSelect) {
            setSelectedIds(prev =>
                prev.includes(id)
                    ? prev.filter(mid => mid !== id)
                    : [...prev, id]
            );
        } else {
            setSelectedIds([id]);
        }
    };

    return (
        <div className="p-3 w-full bg-card-bg">
            <div className="relative mb-3">
                <Search size={16} className="absolute left-0 top-2 text-text-secondary" />
                <input
                    type="text"
                    className="w-full bg-transparent border-b border-text-tertiary focus:border-text-primary py-1 pl-6 text-text-primary outline-none transition-colors text-base placeholder:text-text-tertiary"
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="max-h-60 overflow-y-auto mb-4 custom-scrollbar">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map(option => {
                        const isSelected = selectedIds.includes(option.id);
                        return (
                            <button
                                key={option.id}
                                onClick={() => toggleSelection(option.id)}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 flex items-center justify-between group transition-colors
                                    ${isSelected ? 'bg-menu-item-active-bg text-text-primary' : 'text-text-secondary hover:bg-menu-item-hover-bg hover:text-text-primary'}
                                `}
                            >
                                <div>
                                    <div className="font-medium truncate">{option.label}</div>
                                    {option.description && (
                                        <div className="text-xs opacity-60 truncate">{option.description}</div>
                                    )}
                                </div>
                                {isSelected && <Check size={16} className="text-text-primary" />}
                            </button>
                        );
                    })
                ) : (
                    <div className="text-center py-4 text-text-tertiary text-sm">
                        No results found
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
                <button
                    onClick={() => selectedIds.length > 0 && onApply(selectedIds)}
                    disabled={selectedIds.length === 0}
                    className="bg-menu-item-active-bg text-text-primary font-medium px-4 py-2 rounded-full text-sm hover:bg-button-secondary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Apply
                </button>
            </div>
        </div>
    );
};
