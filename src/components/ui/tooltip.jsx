// shadcn Tooltip — faithful JSX port of the user's pasted shadcn/tooltip on
// the real @radix-ui/react-tooltip (installed). Tokens remapped to the mono
// zinc theme. The original's `animate-in/fade-in-0/...` classes need the
// tailwindcss-animate plugin (not installed) — they were dropped; the tooltip
// is instant, which suits an ops console.
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "../../lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-hair bg-over px-3 py-1.5 text-sm text-ink shadow-md",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
