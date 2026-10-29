import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] cursor-pointer';

    const variants = {
      primary:
        'bg-[#ff7a59] text-white hover:bg-[#e06545] border border-[#e06545] shadow-xs focus:ring-[#ff7a59]/30',
      secondary:
        'bg-[#0091ae] text-white hover:bg-[#007a93] border border-[#007a93] shadow-xs focus:ring-[#0091ae]/30',
      outline:
        'bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#f5f8fa] hover:border-[#99acc2] hover:text-[#2d3e50] shadow-xs focus:ring-[#ff7a59]/20',
      danger:
        'bg-[#f2545b] text-white hover:bg-[#d9383f] border border-[#d9383f] shadow-xs focus:ring-[#f2545b]/30',
      ghost:
        'bg-transparent text-[#33475b] hover:bg-[#f5f8fa] hover:text-[#2d3e50] border border-transparent focus:ring-slate-300',
    };

    const sizes = {
      sm: 'px-2.5 py-1.5 text-xs font-semibold gap-1.5',
      md: 'px-3.5 py-2 text-sm font-semibold gap-2',
      lg: 'px-5 py-2.5 text-base font-semibold gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
