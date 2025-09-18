import * as React from 'react';
import { cn } from '@/utils/cn';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'muted' | 'primary';
}

const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
} as const;

const colorMap = {
    default: 'text-foreground',
    muted: 'text-muted-foreground',
    primary: 'text-primary',
} as const;

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
    ({ className, size = 'md', variant = 'default', ...props }, ref) => {
        return (
            <div ref={ref} className={cn('inline-flex items-center gap-2', className)} {...props}>
                <svg
                    className={cn('animate-spin', sizeMap[size], colorMap[variant])}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    role="status"
                    aria-label="Loading"
                >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                </svg>
            </div>
        );
    },
);
Spinner.displayName = 'Spinner';
