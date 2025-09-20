import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  container?: boolean;
  // visual style variant: default = translucent panel; card = solid card style like upload card
  variant?: 'default' | 'card';
  // whether the drawer should stretch full height (default true). If false, card fits content with max height.
  fullHeight?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onOpenChange,
  children,
  side = 'right',
  container = false,
  variant = 'default',
  fullHeight = true
}) => {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  const positionClasses = container ? 'absolute' : 'fixed';
  const sideClasses = side === 'left' ? 'left-0' : 'right-0';

  const heightClasses = fullHeight ? 'h-full' : 'h-auto max-h-[92vh]';
  const basePanelClasses = `${positionClasses} ${sideClasses} top-0 ${heightClasses} w-full max-w-sm transform transition-all duration-300 ease-out flex flex-col`;
  const visibilityClasses = open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full';
  const variantClasses = variant === 'card'
    ? `bg-card text-card-foreground border border-border rounded-xl shadow-lg m-4 md:m-6 p-0 ${fullHeight ? 'overflow-hidden' : 'overflow-hidden'}`
    : 'bg-card/95 backdrop-blur-sm border-l border-border/40 shadow-xl';

  // For card variant use lighter backdrop similar subtle elevation
  const backdropClasses = variant === 'card' ? 'bg-black/10' : 'bg-black/20 backdrop-blur-sm';

  return (
    <div className={`${positionClasses} inset-0 z-50 flex ${container ? '' : 'lg:left-auto'}`}>
      {/* Backdrop */}
      <div
        className={`${positionClasses} inset-0 ${backdropClasses}`}
        onClick={() => onOpenChange(false)}
      />
      {/* Drawer Panel */}
      <div className={`${basePanelClasses} ${variantClasses} ${visibilityClasses}`} data-variant={variant}>
        {children}
      </div>
    </div>
  );
};

interface DrawerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const DrawerContent: React.FC<DrawerContentProps> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`flex flex-col h-full data-[fit=true]:h-auto ${className}`} {...props}>
    {children}
  </div>
);

interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const DrawerHeader: React.FC<DrawerHeaderProps> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`px-6 py-4 border-b border-border/40 bg-muted/30 data-[variant=card]:bg-transparent data-[variant=card]:border-b data-[variant=card]:border-border ${className}`} {...props}>
    {children}
  </div>
);

interface DrawerTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const DrawerTitle: React.FC<DrawerTitleProps> = ({
  children,
  className = '',
  ...props
}) => (
  <h2 className={`text-lg font-semibold ${className}`} {...props}>
    {children}
  </h2>
);

interface DrawerDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const DrawerDescription: React.FC<DrawerDescriptionProps> = ({
  children,
  className = '',
  ...props
}) => (
  <p className={`text-sm text-muted-foreground ${className}`} {...props}>
    {children}
  </p>
);

interface DrawerCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClose?: () => void;
}

export const DrawerClose: React.FC<DrawerCloseProps> = ({
  onClose,
  className = '',
  ...props
}) => (
  <Button
    variant="ghost"
    size="sm"
    onClick={onClose}
    className={`absolute right-2 top-2 ${className}`}
    {...props}
  >
    <X className="h-4 w-4" />
  </Button>
);

interface DrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const DrawerBody: React.FC<DrawerBodyProps> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`px-6 py-4 overflow-y-auto flex-1 ${className}`} {...props}>
    {children}
  </div>
);

interface DrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const DrawerFooter: React.FC<DrawerFooterProps> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`px-6 py-4 border-t border-border/40 bg-muted/30 data-[variant=card]:bg-transparent data-[variant=card]:border-t data-[variant=card]:border-border ${className}`} {...props}>
    {children}
  </div>
);

// For trigger buttons that open the drawer
interface DrawerTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

export const DrawerTrigger: React.FC<DrawerTriggerProps> = ({
  children,
  asChild = false,
  ...props
}) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props as any);
  }

  return (
    <button {...props}>
      {children}
    </button>
  );
};