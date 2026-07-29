import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'secondary';
  customStyle?: { bg: string; text: string; border: string };
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  customStyle,
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

  if (customStyle) {
    return (
      <span
        className={twMerge(
          clsx(baseClasses, customStyle.bg, customStyle.text, customStyle.border, className)
        )}
        {...props}
      >
        {children}
      </span>
    );
  }

  const variantClasses =
    variant === 'outline'
      ? 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
      : variant === 'secondary'
      ? 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
      : 'border-transparent bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900';

  return (
    <span className={twMerge(clsx(baseClasses, variantClasses, className))} {...props}>
      {children}
    </span>
  );
};
