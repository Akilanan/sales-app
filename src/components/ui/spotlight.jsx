// Spotlight — a soft, blurred light-beam ellipse that eases in on mount (aceternity).
// Ported to JSX for this Vite project: TS types stripped, `'use client'` removed,
// `@/lib/utils` → relative, the animation keyframe lives in index.css (so a tailwind
// config change isn't needed), and the SVG filter id is namespaced to avoid clashes.
import React from "react";
import { cn } from "../../lib/utils";

export function Spotlight({ className, fill }) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute h-[169%] w-[138%] lg:w-[84%] opacity-0 will-change-transform",
        className
      )}
      style={{ animation: "spotlight 2.4s ease 0.35s 1 forwards" }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
      aria-hidden="true"
    >
      <g filter="url(#spotlight-blur)">
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill || "white"}
          fillOpacity="0.21"
        />
      </g>
      <defs>
        <filter
          id="spotlight-blur"
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}

export default Spotlight;
