import React from 'react';

export const StatsBadge: React.FC<{ label: string; value: string; tooltip?: string }> = ({ label, value, tooltip }) => (
  <div
    className="flex flex-col items-start px-3 py-2 rounded-xl border border-border bg-card shadow-sm min-w-[88px]"
    title={tooltip}
  >
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{value}</span>
  </div>
);

interface ToolbarButtonProps {
  title: string;
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({ title, onClick, children, disabled }) => (
  <button
    type="button"
    title={title}
    onClick={() => { if (!disabled) onClick(); }}
    disabled={disabled}
    className={`inline-flex items-center justify-center w-8 h-8 rounded border border-border bg-background text-foreground ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}`}
  >
    {children}
  </button>
);
