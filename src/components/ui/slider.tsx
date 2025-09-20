import * as React from 'react';

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ value, onValueChange, min = 0, max = 100, step = 1, className = '', ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange([parseFloat(e.target.value)]);
    };

    const percentage = ((value[0] - min) / (max - min)) * 100;

    return (
      <div className="relative w-full py-2">
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={handleChange}
          className={`
            relative w-full h-5 appearance-none cursor-pointer bg-transparent
            [&::-webkit-slider-track]:w-full [&::-webkit-slider-track]:h-2 [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:bg-secondary
            [&::-moz-range-track]:w-full [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-secondary [&::-moz-range-track]:border-0
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:mt-[-6px]
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:mt-[-6px]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
            disabled:pointer-events-none disabled:opacity-50
            ${className}
          `}
          {...props}
        />
        {/* Progress fill indicator */}
        <div
          className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-l-full bg-primary pointer-events-none transition-all duration-200"
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
);

Slider.displayName = 'Slider';