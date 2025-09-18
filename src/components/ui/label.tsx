import * as React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> { }

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className = '', ...props }, ref) => {
    const cls = `text-sm font-medium text-foreground ${className}`;
    return <label ref={ref} className={cls} {...props} />;
});
Label.displayName = 'Label';

export default Label;
