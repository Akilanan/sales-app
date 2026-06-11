// Tubelight NavBar — faithful JSX port of the user's pasted tubelight-navbar.tsx
// (21st.dev). Adapted from Next/TSX to Vite/JSX: next/link → <a>, TS stripped,
// motion → m (LazyMotion strict, domMax provides layoutId springs), shadcn
// tokens → app mono tokens (the "tube" reads as a literal white light bar on
// the zinc theme). Icon-agnostic: pass any icon component (the app passes
// Phosphor; lucide-react was not added). Extra props for this SPA (no router):
// `activeTab` (controlled) + `onItemClick` — internal state still works
// uncontrolled, exactly like the original.
import React, { useState } from "react";
import { m } from "framer-motion";
import { cn } from "../../lib/utils";

export function NavBar({ items, className, activeTab: controlledTab, onItemClick }) {
  const [internalTab, setInternalTab] = useState(items[0].name);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  return (
    <div
      className={cn(
        // Mobile: a full-width bottom bar (thumb-reach, big tap targets).
        // sm+: the floating tubelight pill, top-center.
        "fixed z-50 left-2 right-2 bottom-2 sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-0 sm:-translate-x-1/2 sm:pt-6",
        "pb-[env(safe-area-inset-bottom)] sm:pb-0",
        className,
      )}
    >
      <div className="flex items-stretch sm:items-center justify-around sm:justify-center gap-1 sm:gap-3 bg-base/85 sm:bg-white/5 border border-hair backdrop-blur-lg py-1 px-1 rounded-2xl sm:rounded-full shadow-lg">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;

          return (
            <a
              key={item.name}
              href={item.url}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                if (onItemClick) e.preventDefault();
                setInternalTab(item.name);
                if (onItemClick) onItemClick(item);
              }}
              className={cn(
                "relative cursor-pointer font-semibold rounded-xl sm:rounded-full transition-colors",
                // Mobile: icon+label stacked, ≥52px tall, share width evenly.
                "flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-0.5 min-h-[52px] sm:min-h-0 px-1 sm:px-6 py-1.5 sm:py-2 text-[10px] sm:text-sm",
                "text-ink-soft hover:text-ink",
                isActive && "bg-white/[0.08] text-ink",
              )}
            >
              <Icon size={19} weight={isActive ? "fill" : "bold"} className="sm:hidden" />
              <span className="sm:hidden leading-none">{item.name}</span>
              <span className="hidden sm:inline">{item.name}</span>
              {isActive && (
                <m.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-white/5 rounded-full -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-300 rounded-t-full">
                    <div className="absolute w-12 h-6 bg-white/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-white/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-white/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </m.div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
