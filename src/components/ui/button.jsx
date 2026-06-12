// shadcn Button — faithful JSX port of the user's pasted button.tsx, with the
// shadcn CSS-var tokens remapped to the app's mono zinc theme. Uses the real
// cva + @radix-ui/react-slot (installed). House rules applied: primary = silver
// with DARK text (never white-on-silver); destructive echoes the MetalButton
// "error" family. LiquidButton/MetalButton stay the showcase CTAs — this is
// the workhorse for secondary/ghost/outline needs.
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-300 text-zinc-900 shadow-sm shadow-black/5 hover:bg-brand-400",
        destructive: "bg-[#A45253] text-white shadow-sm shadow-black/5 hover:bg-[#8f4647]",
        outline: "border border-hair bg-inset shadow-sm shadow-black/5 hover:bg-over hover:text-ink",
        secondary: "bg-inset text-ink shadow-sm shadow-black/5 hover:bg-over",
        ghost: "hover:bg-white/[0.06] hover:text-ink",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
