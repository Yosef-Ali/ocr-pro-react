import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
const MotionDiv = motion.div as any;

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
    footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-lg',
    footer
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <MotionDiv
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={onClose}
                >
                    <MotionDiv
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className={`bg-card text-card-foreground rounded-xl w-full ${maxWidth} mx-4 shadow-xl border border-border`}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-6 pt-6 pb-3">
                            <h2 className="text-2xl font-bold">{title}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-lg transition-colors"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="max-h-[70vh] overflow-y-auto px-6 pb-4">
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                                {footer}
                            </div>
                        )}
                    </MotionDiv>
                </MotionDiv>
            )}
        </AnimatePresence>
    );
};