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
        "fixed bottom-0 sm:top-0 sm:bottom-auto left-1/2 -translate-x-1/2 z-50 mb-6 sm:mb-0 sm:pt-6",
        className,
      )}
    >
      <div className="flex items-center gap-3 bg-white/5 border border-hair backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
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
                "relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors",
                "text-ink-soft hover:text-ink",
                isActive && "bg-white/[0.08] text-ink",
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} weight={isActive ? "fill" : "bold"} />
              </span>
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
