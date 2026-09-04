import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-blue-500/15 text-blue-600 border border-blue-500/25 dark:text-blue-400',
        green: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 dark:text-emerald-400',
        purple: 'bg-slate-500/15 text-slate-600 border border-slate-500/25 dark:text-slate-300',
        red: 'bg-red-500/15 text-red-600 border border-red-500/25 dark:text-red-400',
        amber: 'bg-amber-500/15 text-amber-700 border border-amber-500/25 dark:text-amber-400',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
