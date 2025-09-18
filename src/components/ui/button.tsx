import * as React from 'react';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<Variant, string> = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-900/5 text-gray-900 hover:bg-gray-900/10',
    outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    link: 'text-blue-600 underline-offset-4 hover:underline bg-transparent',
};

const sizeClasses: Record<Size, string> = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-base',
    icon: 'h-10 w-10',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'default', size = 'md', ...props }, ref) => {
        const cls = `${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
        return <button ref={ref} className={cls} {...props} />;
    }
);
Button.displayName = 'Button';

export default Button;
