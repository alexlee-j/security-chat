import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          role="switch"
          className="sr-only peer"
          ref={ref}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div
          className={cn(
            "w-9 h-5 bg-input peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer",
            "peer-checked:bg-primary transition-colors duration-200 ease-in-out",
            className
          )}
        >
          <div
            className={cn(
              "h-4 w-4 mt-0.5 bg-background rounded-full shadow-sm transition-transform duration-200 ease-in-out",
              "translate-x-0.5",
              "peer-checked:translate-x-4"
            )}
          />
        </div>
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
