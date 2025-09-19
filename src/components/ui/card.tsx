import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', ...props }, ref) => {
    const cls = `rounded-lg border border-border bg-card text-card-foreground shadow-sm ${className}`;
    return <div ref={ref} className={cls} {...props} />;
  }
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', ...props }, ref) => {
    const cls = `flex flex-col space-y-1.5 p-6 ${className}`;
    return <div ref={ref} className={cls} {...props} />;
  }
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = React.forwardRef<HTMLParagraphElement, CardTitleProps>(
  ({ className = '', ...props }, ref) => {
    const cls = `text-2xl font-semibold leading-none tracking-tight ${className}`;
    return <h3 ref={ref} className={cls} {...props} />;
  }
);
CardTitle.displayName = 'CardTitle';

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = '', ...props }, ref) => {
    const cls = `text-sm text-muted-foreground ${className}`;
    return <p ref={ref} className={cls} {...props} />;
  }
);
CardDescription.displayName = 'CardDescription';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', ...props }, ref) => {
    const cls = `p-6 pt-0 ${className}`;
    return <div ref={ref} className={cls} {...props} />;
  }
);
CardContent.displayName = 'CardContent';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', ...props }, ref) => {
    const cls = `flex items-center p-6 pt-0 ${className}`;
    return <div ref={ref} className={cls} {...props} />;
  }
);
CardFooter.displayName = 'CardFooter';