import * as React from 'react';
import { cn } from '@/utils/cn';

export type AlertVariant = 'default' | 'success' | 'destructive' | 'warning' | 'info';

const variantClasses: Record<AlertVariant, string> = {
    default: 'bg-gray-50 text-gray-800 border-gray-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    destructive: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: AlertVariant;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        return (
            <div
                ref={ref}
                role="alert"
                className={cn(
                    'w-full rounded-md border p-4 text-sm',
                    variantClasses[variant],
                    className,
                )}
                {...props}
            />
        );
    },
);
Alert.displayName = 'Alert';

export interface AlertTitleProps extends React.HTMLAttributes<HTMLParagraphElement> { }

export const AlertTitle = React.forwardRef<HTMLParagraphElement, AlertTitleProps>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
    ),
);
AlertTitle.displayName = 'AlertTitle';

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> { }

export const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('text-sm opacity-90', className)} {...props} />
    ),
);
AlertDescription.displayName = 'AlertDescription';
