import * as React from 'react';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className = '', label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const switchId = id || generatedId;
    
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="relative">
          <input
            type="checkbox"
            id={switchId}
            ref={ref}
            className="sr-only peer"
            {...props}
          />
          <div className="w-11 h-6 bg-muted border border-border rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 peer-checked:bg-primary transition-colors duration-200 ease-in-out">
            <div className="w-5 h-5 bg-background border border-border rounded-full shadow-sm transition-transform duration-200 ease-in-out peer-checked:translate-x-5 peer-checked:border-primary-foreground"></div>
          </div>
        </div>
        {label && (
          <label htmlFor={switchId} className="text-sm font-medium text-foreground cursor-pointer">
            {label}
          </label>
        )}
      </div>
    );
  }
);
Switch.displayName = 'Switch';