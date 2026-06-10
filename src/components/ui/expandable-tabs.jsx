// Expandable Tabs — faithful JSX port of the user's pasted expandable-tabs.tsx
// (21st.dev). TS stripped, motion → m (LazyMotion strict), shadcn tokens → app
// mono tokens. usehooks-ts was not added — its useOnClickOutside is inlined
// below (same behavior, zero deps). Icon-agnostic: pass Phosphor (or any)
// icon components; lucide-react was not added.
import * as React from "react";
import { AnimatePresence, m } from "framer-motion";
import { cn } from "../../lib/utils";

function useOnClickOutside(ref, handler) {
  React.useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (isSelected) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "1rem" : ".5rem",
    paddingRight: isSelected ? "1rem" : ".5rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring", bounce: 0, duration: 0.6 };

export function ExpandableTabs({ tabs, className, activeColor = "text-ink", onChange }) {
  const [selected, setSelected] = React.useState(null);
  const outsideClickRef = React.useRef(null);

  useOnClickOutside(outsideClickRef, () => {
    setSelected(null);
    if (onChange) onChange(null);
  });

  const handleSelect = (index) => {
    setSelected(index);
    if (onChange) onChange(index);
  };

  const Separator = () => <div className="mx-1 h-[24px] w-[1.2px] bg-hair" aria-hidden="true" />;

  return (
    <div
      ref={outsideClickRef}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-hair bg-panel p-1 shadow-sm",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        if (tab.type === "separator") {
          return <Separator key={`separator-${index}`} />;
        }

        const Icon = tab.icon;
        return (
          <m.button
            key={tab.title}
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={selected === index}
            onClick={() => handleSelect(index)}
            transition={transition}
            className={cn(
              "relative flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-300",
              selected === index
                ? cn("bg-white/[0.07]", activeColor)
                : "text-ink-dim hover:bg-white/[0.06] hover:text-ink",
            )}
          >
            <Icon size={20} />
            <AnimatePresence initial={false}>
              {selected === index && (
                <m.span
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="overflow-hidden"
                >
                  {tab.title}
                </m.span>
              )}
            </AnimatePresence>
          </m.button>
        );
      })}
    </div>
  );
}
