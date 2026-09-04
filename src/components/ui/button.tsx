import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(37,99,235,0.45)] active:translate-y-0',
        secondary:
          'border border-border bg-card text-foreground hover:bg-accent hover:border-blue-300',
        danger:
          'border border-red-300/40 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:border-red-500',
        ghost:
          'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-accent',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3 text-xs rounded-lg',
        lg: 'h-12 px-8 text-base rounded-2xl',
        icon: 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
