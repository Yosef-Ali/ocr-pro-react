import * as React from 'react';

export interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onOpenChange(false);
        };
        if (open) document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onOpenChange]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => onOpenChange(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative z-10 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
    <div className={`rounded-xl bg-white shadow-xl border ${className}`} {...props} />
);

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
    <div className={`px-6 pt-6 pb-3 ${className}`} {...props} />
);

export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', ...props }) => (
    <h2 className={`text-2xl font-bold text-gray-800 ${className}`} {...props} />
);

export const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', ...props }) => (
    <p className={`text-sm text-gray-600 ${className}`} {...props} />
);

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
    <div className={`px-6 py-4 border-t flex justify-end gap-3 ${className}`} {...props} />
);

export const DialogBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
    <div className={`max-h-[70vh] overflow-y-auto px-6 pb-4 ${className}`} {...props} />
);

export const DialogClose: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
    <button className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${className}`} {...props} />
);

export default Dialog;
