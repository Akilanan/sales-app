// shadcn Toggle — faithful JSX port of the user's pasted shadcn/toggle, built
// on the real @radix-ui/react-toggle (installed). shadcn tokens remapped to
// the app's mono zinc theme.
import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-white/[0.06] hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-white/[0.08] data-[state=on]:text-ink",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-hair bg-transparent hover:bg-white/[0.06] hover:text-ink",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
