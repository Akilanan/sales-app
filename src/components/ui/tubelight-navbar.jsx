// Tubelight NavBar — faithful JSX port of the user's pasted tubelight-navbar.tsx
// (21st.dev). Adapted from Next/TSX to Vite/JSX: next/link → <button>, TS stripped,
// motion → m (LazyMotion strict, domMax provides layoutId springs), shadcn
// tokens → app mono tokens (the "tube" reads as a literal white light bar on
// the zinc theme). Icon-agnostic: pass any icon component (the app passes
// Phosphor; lucide-react was not added). Extra props for this SPA (no router):
// `activeTab` (controlled) + `onItemClick` — internal state still works
// uncontrolled, exactly like the original.
import React, { useState } from "react";
import { m } from "framer-motion";
import { cn } from "../../lib/utils";
import { spring } from "../../lib/motion";

export function NavBar({ items, className, activeTab: controlledTab, onItemClick }) {
  const [internalTab, setInternalTab] = useState(items[0].name);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  return (
    <div
      className={cn(
        // Phones AND tablets (<lg): a full-width bottom bar — thumb-reach, big
        // tap targets, and no collision with the header wordmark (the top pill
        // overlapped it at 768-1024px). lg+: the floating tubelight pill, top-center.
        "fixed z-50 left-2 right-2 bottom-2 lg:left-1/2 lg:right-auto lg:bottom-auto lg:top-0 lg:-translate-x-1/2 lg:pt-6",
        "pb-[env(safe-area-inset-bottom)] lg:pb-0",
        className,
      )}
    >
      <div className="flex items-stretch lg:items-center justify-around lg:justify-center gap-1 lg:gap-3 bg-base/85 lg:bg-white/5 border border-hair backdrop-blur-lg py-1 px-1 rounded-2xl lg:rounded-full shadow-lg">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;

          return (
            // a <button>, not an href-less <a>: the SPA passes no URLs, and an
            // anchor without href has NO role — unfocusable, invisible to screen
            // readers, flaky for automation. A real button restores keyboard nav.
            <button
              key={item.name}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (controlledTab === undefined) setInternalTab(item.name); // only own the state when uncontrolled — avoids dead writes + desync when the parent controls activeTab
                if (onItemClick) onItemClick(item);
              }}
              className={cn(
                "relative cursor-pointer font-semibold rounded-xl lg:rounded-full transition-colors",
                // <lg: icon+label stacked, ≥52px tall, share width evenly.
                "flex-1 lg:flex-none flex flex-col lg:flex-row items-center justify-center gap-0.5 min-h-[52px] lg:min-h-0 px-1 lg:px-6 py-1.5 lg:py-2 text-[10px] lg:text-sm",
                "text-ink-soft hover:text-ink",
                isActive && "bg-white/[0.08] text-ink",
              )}
            >
              <Icon size={19} weight={isActive ? "fill" : "bold"} className="lg:hidden" />
              <span className="lg:hidden leading-none">{item.name}</span>
              <span className="hidden lg:inline">{item.name}</span>
              {isActive && (
                <m.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-white/5 rounded-full -z-10"
                  initial={false}
                  transition={spring.nav}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-300 rounded-t-full">
                    <div className="absolute w-12 h-6 bg-white/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-white/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-white/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </m.div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
