import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleProps {
    title: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

export const Collapsible: React.FC<CollapsibleProps> = ({ title, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg">
            <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                onClick={() => setOpen(o => !o)}
            >
                <div className="text-sm font-medium text-gray-800">{title}</div>
                {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            </button>
            {open && (
                <div className="px-3 pb-3 pt-1 bg-white">
                    {children}
                </div>
            )}
        </div>
    );
};