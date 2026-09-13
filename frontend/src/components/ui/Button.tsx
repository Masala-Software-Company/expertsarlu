import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-ui disabled:opacity-50',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-12 px-5 text-base',
          variant === 'primary' && 'bg-brand text-white hover:bg-brand-hover shadow-soft',
          variant === 'secondary' &&
            'bg-surface text-ink border border-[var(--border)] hover:border-brand/40',
          variant === 'ghost' && 'bg-transparent hover:bg-brand/10 text-ink',
          variant === 'danger' && 'bg-danger text-white hover:bg-red-700',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
