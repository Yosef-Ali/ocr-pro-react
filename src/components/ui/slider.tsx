import * as React from 'react';

export interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string; // explicit to satisfy TS build
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export const CustomSlider: React.FC<SliderProps> = ({
  id,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  disabled = false,
  ...rest
}) => {
  const percent = ((value[0] - min) / (max - min)) * 100;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    const clamped = Math.min(max, Math.max(min, stepped));
    onValueChange([clamped]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let delta = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    if (delta !== 0) {
      e.preventDefault();
      const next = Math.min(max, Math.max(min, value[0] + delta));
      onValueChange([next]);
    }
  };

  return (
    <div className={`w-full select-none ${className}`} id={id} {...rest}>
      <div
        className="relative h-6 flex items-center"
        onPointerDown={onPointerDown}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value[0]}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
      >
        <div className="absolute inset-x-0 h-2 rounded-full bg-secondary/70" />
        <div
          className="absolute h-2 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-background bg-primary shadow transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ left: `calc(${percent}% - 8px)` }}
          onPointerDown={(e) => {
            if (disabled) return;
            const move = (ev: PointerEvent) => {
              const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
              const ratio = (ev.clientX - rect.left) / rect.width;
              const raw = min + ratio * (max - min);
              const stepped = Math.round(raw / step) * step;
              const clamped = Math.min(max, Math.max(min, stepped));
              onValueChange([clamped]);
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        />
      </div>
    </div>
  );
};