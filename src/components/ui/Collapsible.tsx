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
        <div className="border border-border rounded-lg bg-card text-card-foreground">
            <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent"
                onClick={() => setOpen(o => !o)}
            >
                <div className="text-sm font-medium">{title}</div>
                {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
            {open && (
                <div className="px-3 pb-3 pt-1 bg-card">
                    {children}
                </div>
            )}
        </div>
    );
};