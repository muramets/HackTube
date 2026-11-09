import React, { useState } from 'react';

interface FilterInputTitleProps {
    value: string;
    onApply: (value: string) => void;
}

export const FilterInputTitle: React.FC<FilterInputTitleProps> = ({ value, onApply }) => {
    const [inputValue, setInputValue] = useState(value || '');

    return (
        <div className="p-3 w-full bg-card-bg">
            <div className="mb-2 text-sm text-text-secondary">contains</div>
            <input
                type="text"
                autoFocus
                className="w-full bg-transparent border-b border-text-tertiary focus:border-text-primary py-1 text-text-primary outline-none transition-colors text-base"
                placeholder="Value"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        onApply(inputValue);
                    }
                }}
            />
            <div className="flex justify-end mt-4">
                <button
                    onClick={() => onApply(inputValue)}
                    className="bg-menu-item-active-bg text-text-primary font-medium px-4 py-2 rounded-full text-sm hover:bg-button-secondary-hover transition-colors"
                >
                    Apply
                </button>
            </div>
        </div>
    );
};
