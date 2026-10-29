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
      ? 'border-[#cbd6e2] text-[#33475b] bg-white'
      : variant === 'secondary'
      ? 'border-transparent bg-[#eaf0f6] text-[#33475b]'
      : 'border-transparent bg-[#2d3e50] text-white';

  return (
    <span className={twMerge(clsx(baseClasses, variantClasses, className))} {...props}>
      {children}
    </span>
  );
};
