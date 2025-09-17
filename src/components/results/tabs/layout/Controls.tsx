import React from 'react';

export const StatsBadge: React.FC<{ label: string; value: string; tooltip?: string }> = ({ label, value, tooltip }) => (
  <div
    className="flex flex-col items-start px-3 py-2 rounded-xl border border-gray-200 bg-white shadow-sm min-w-[88px]"
    title={tooltip}
  >
    <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
    <span className="text-sm font-semibold text-gray-900">{value}</span>
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
    className={`inline-flex items-center justify-center w-8 h-8 rounded border bg-white text-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
  >
    {children}
  </button>
);
