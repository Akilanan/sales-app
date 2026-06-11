// Premium buttons — faithful JSX ports of the shadcn components the user pasted
// (liquid-glass-button.tsx + MetalButton), adapted from Next/TSX/Tailwind-4 to
// Vite/JSX/Tailwind-3. The app is permanently dark (no `.dark` class toggling),
// so the original `dark:` variant styles are inlined as the base styles here.
import React from "react";
import { cn } from "../../lib/utils";

/* --------------------------- Liquid Glass button -------------------------- */
// Real glass: an SVG turbulence/displacement filter behind the label + a layered
// inset-shadow shell that reads as a refracting edge. backdrop-filter: url(#…)
// is Chromium-supported (the shop-floor tablets run Chrome/Edge).

function GlassFilter() {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter id="container-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="70" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

const liquidSizes = {
  default: "h-9 px-4 py-2",
  lg: "h-10 px-6",
  xl: "h-12 px-8",
  xxl: "h-14 px-10",
};

// the dark-mode shell shadow from the pasted component, promoted to the base layer
const glassShell =
  "shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]";

export const LiquidButton = React.forwardRef(function LiquidButton(
  { className, children, size = "xl", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      data-slot="button"
      className={cn(
        "relative inline-flex items-center justify-center cursor-pointer gap-2 whitespace-nowrap rounded-md text-sm font-semibold text-ink shrink-0 outline-none",
        // asymmetric press physics: instant-feeling 75ms press-down, 300ms release
        "transition-transform duration-300 hover:scale-[1.03] active:scale-[0.99] active:duration-75",
        "focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "disabled:pointer-events-none disabled:opacity-50",
        liquidSizes[size] || liquidSizes.xl,
        className
      )}
      {...props}
    >
      <div className={cn("absolute top-0 left-0 z-0 h-full w-full rounded-md transition-all", glassShell)} />
      <div
        className="absolute top-0 left-0 isolate -z-10 h-full w-full overflow-hidden rounded-md"
        style={{ backdropFilter: 'url("#container-glass")' }}
      />
      <div className="pointer-events-none z-10 inline-flex items-center gap-2">{children}</div>
      <GlassFilter />
    </button>
  );
});

/* ------------------------------ Metal button ------------------------------ */
// Brushed-metal pill with a 1.25px gradient bezel, an inner gradient sheen, and
// real press physics (translate + scale + shadow). Variants are hex-based so they
// don't depend on shadcn CSS-var tokens.

const colorVariants = {
  default: {
    outer: "bg-gradient-to-b from-[#000] to-[#A0A0A0]",
    inner: "bg-gradient-to-b from-[#FAFAFA] via-[#3E3E3E] to-[#E5E5E5]",
    // Brighter brushed silver + DARK engraved label = premium and clearly
    // readable (~9:1), vs the old white-on-silver (~2:1).
    button: "bg-gradient-to-b from-[#EDEDED] to-[#B6B6B6]",
    textColor: "text-zinc-900",
    textShadow: "[text-shadow:_0_1px_0_rgb(255_255_255_/_55%)]",
  },
  success: {
    outer: "bg-gradient-to-b from-[#005A43] to-[#7CCB9B]",
    inner: "bg-gradient-to-b from-[#E5F8F0] via-[#00352F] to-[#D1F0E6]",
    button: "bg-gradient-to-b from-[#9ADBC8] to-[#3E8F7C]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(6_78_59_/_100%)]",
  },
  error: {
    outer: "bg-gradient-to-b from-[#5A0000] to-[#FFAEB0]",
    inner: "bg-gradient-to-b from-[#FFDEDE] via-[#680002] to-[#FFE9E9]",
    button: "bg-gradient-to-b from-[#F08D8F] to-[#A45253]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(146_64_14_/_100%)]",
  },
  gold: {
    outer: "bg-gradient-to-b from-[#917100] to-[#EAD98F]",
    inner: "bg-gradient-to-b from-[#FFFDDD] via-[#856807] to-[#FFF1B3]",
    button: "bg-gradient-to-b from-[#FFEBA1] to-[#9B873F]",
    textColor: "text-[#FFFDE5]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(178_140_2_/_100%)]",
  },
  bronze: {
    outer: "bg-gradient-to-b from-[#864813] to-[#E9B486]",
    inner: "bg-gradient-to-b from-[#EDC5A1] via-[#5F2D01] to-[#FFDEC1]",
    button: "bg-gradient-to-b from-[#FFE3C9] to-[#A36F3D]",
    textColor: "text-[#FFF7F0]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(124_45_18_/_100%)]",
  },
};

const metalVariants = (variant, isPressed, isHovered, isTouchDevice) => {
  const colors = colorVariants[variant] || colorVariants.default;
  // Asymmetric press physics: the press-down must FEEL instant (≤100ms is the
  // "direct manipulation" threshold), the release can luxuriate at 250ms. Only
  // compositor/cheap properties — never `all`.
  const transition = isPressed
    ? "transform 70ms ease-out, box-shadow 70ms ease-out, filter 70ms ease-out"
    : "transform 250ms cubic-bezier(0.1, 0.4, 0.2, 1), box-shadow 250ms cubic-bezier(0.1, 0.4, 0.2, 1), filter 250ms cubic-bezier(0.1, 0.4, 0.2, 1)";
  return {
    wrapper: cn("relative inline-flex transform-gpu rounded-md p-[1.25px] will-change-transform", colors.outer),
    wrapperStyle: {
      transform: isPressed ? "translateY(2.5px) scale(0.99)" : "translateY(0) scale(1)",
      boxShadow: isPressed
        ? "0 1px 2px rgba(0,0,0,0.15)"
        : isHovered && !isTouchDevice
        ? "0 4px 12px rgba(0,0,0,0.12)"
        : "0 3px 8px rgba(0,0,0,0.08)",
      transition,
      transformOrigin: "center center",
    },
    inner: cn("absolute inset-[1px] transform-gpu rounded-md will-change-transform", colors.inner),
    innerStyle: {
      transition,
      transformOrigin: "center center",
      filter: isHovered && !isPressed && !isTouchDevice ? "brightness(1.05)" : "none",
    },
    button: cn(
      "relative z-10 m-[1px] inline-flex h-11 transform-gpu cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md px-6 py-2 text-sm leading-none font-semibold will-change-transform outline-none focus-visible:ring-2 focus-visible:ring-white/40",
      colors.button,
      colors.textColor,
      colors.textShadow
    ),
    buttonStyle: {
      transform: isPressed ? "scale(0.97)" : "scale(1)",
      transition,
      transformOrigin: "center center",
      filter: isHovered && !isPressed && !isTouchDevice ? "brightness(1.02)" : "none",
    },
  };
};

function ShineEffect({ isPressed }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-300", isPressed ? "opacity-20" : "opacity-0")}>
      <div className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-neutral-100 to-transparent" />
    </div>
  );
}

export const MetalButton = React.forwardRef(function MetalButton(
  { children, className, variant = "default", fullWidth = false, ...props },
  ref
) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  // Hover capability, not touch presence: "ontouchstart" wrongly kills hover on
  // touchscreen laptops that also have a mouse. matchMedia answers the real question.
  const [noHover, setNoHover] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setNoHover(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const v = metalVariants(variant, isPressed, isHovered, noHover);

  return (
    <div className={cn(v.wrapper, fullWidth && "flex w-full")} style={v.wrapperStyle}>
      <div className={v.inner} style={v.innerStyle} />
      <button
        ref={ref}
        className={cn(v.button, fullWidth && "w-full", className)}
        style={v.buttonStyle}
        {...props}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => { setIsPressed(false); setIsHovered(false); }}
        onMouseEnter={() => { if (!noHover) setIsHovered(true); }}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        onTouchCancel={() => setIsPressed(false)}
        // Enter/Space must press the metal too — keyboard users get the same physics
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) setIsPressed(true); }}
        onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") setIsPressed(false); }}
        onBlur={() => setIsPressed(false)}
      >
        <ShineEffect isPressed={isPressed} />
        {children || "Button"}
        {isHovered && !isPressed && !noHover && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t rounded-md from-transparent to-white/5" />
        )}
      </button>
    </div>
  );
});
