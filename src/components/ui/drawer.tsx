import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  container?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({ 
  open, 
  onOpenChange, 
  children, 
  side = 'right',
  container = false 
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
  
  return (
    <div className={`${positionClasses} inset-0 z-50 ${container ? '' : 'lg:left-auto'}`}>
      {/* Backdrop */}
      <div 
        className={`${positionClasses} inset-0 bg-black/20 backdrop-blur-sm`}
        onClick={() => onOpenChange(false)}
      />
      
      {/* Drawer Panel */}
      <div 
        className={`${positionClasses} ${sideClasses} top-0 h-full w-full max-w-sm bg-background/95 backdrop-blur-sm border-l border-border/50 shadow-xl transform transition-all duration-300 ease-out ${
          open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full'
        }`}
      >
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
  <div className={`h-full flex flex-col ${className}`} {...props}>
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
  <div className={`px-4 py-3 border-b border-border ${className}`} {...props}>
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
  <div className={`flex-1 overflow-y-auto px-4 py-3 ${className}`} {...props}>
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
  <div className={`px-4 py-3 border-t border-border ${className}`} {...props}>
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