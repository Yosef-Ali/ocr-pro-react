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
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  const updateFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    const clamped = Math.min(max, Math.max(min, stepped));
    onValueChange([clamped]);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    updateFromClientX(e.clientX);
    const move = (ev: PointerEvent) => updateFromClientX(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
    <div className={`w-full select-none py-1 ${className}`} id={id} {...rest}>
      <div
        ref={trackRef}
        className="relative h-8 flex items-center cursor-pointer touch-none select-none"
        onPointerDown={onPointerDown}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value[0]}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
      >
        {/* Expanded invisible hit area */}
        <div className="absolute inset-0" />
        {/* Track */}
        <div className="absolute left-2 right-2 h-1.5 rounded-full bg-secondary/60" />
        {/* Fill */}
        <div className="absolute left-2 h-1.5 rounded-full bg-primary transition-[width]" style={{ width: `calc(${percent}% - 0px)` }} />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary shadow ring-2 ring-background/80 border border-border flex items-center justify-center transition transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ left: `calc(${percent}% + 0px)`, transform: 'translate(-50%, -50%)' }}
          onPointerDown={(e) => {
            if (disabled) return;
            e.stopPropagation();
            updateFromClientX(e.clientX);
            const move = (ev: PointerEvent) => updateFromClientX(ev.clientX);
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        >
          <div className="h-2 w-2 rounded-full bg-background/80" />
        </div>
      </div>
    </div>
  );
};