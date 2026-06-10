// ScrollExpandMedia — faithful JSX port of the user's pasted scroll-expansion-hero.tsx.
// Adapted: next/image -> <img>, TS removed, framer-motion `m` (LazyMotion strict),
// image onError fallback, and accessibility additions for an ops-console login:
//   - prefers-reduced-motion expands immediately (no scroll-jacking)
//   - a tap/click anywhere + an explicit "Enter" button jump to fully expanded
// The expanding media reveals `children` (the sign-in form) once fully open.
import React, { useEffect, useRef, useState, useCallback } from "react";
import { m } from "framer-motion";
import { MetalButton } from "./buttons";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ScrollExpandMedia({
  mediaSrc,
  bgImageSrc,
  title,
  date,
  scrollToExpand,
  textBlend,
  enterLabel = "Enter Console",
  children,
}) {
  const [scrollProgress, setScrollProgress] = useState(REDUCED ? 1 : 0);
  const [showContent, setShowContent] = useState(REDUCED);
  const [mediaFullyExpanded, setMediaFullyExpanded] = useState(REDUCED);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isMobileState, setIsMobileState] = useState(false);
  const contentRef = useRef(null);

  // Jump straight to fully-expanded + revealed (tap / button / reduced-motion).
  const jumpToExpanded = useCallback(() => {
    setScrollProgress(1);
    setMediaFullyExpanded(true);
    setShowContent(true);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() =>
        contentRef.current?.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" })
      );
    }
  }, []);

  useEffect(() => {
    if (REDUCED) return; // already expanded; don't hijack scroll

    const handleWheel = (e) => {
      if (mediaFullyExpanded && e.deltaY < 0 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        e.preventDefault();
      } else if (!mediaFullyExpanded) {
        e.preventDefault();
        const newProgress = Math.min(Math.max(scrollProgress + e.deltaY * 0.0009, 0), 1);
        setScrollProgress(newProgress);
        if (newProgress >= 1) { setMediaFullyExpanded(true); setShowContent(true); }
        else if (newProgress < 0.75) setShowContent(false);
      }
    };
    const handleTouchStart = (e) => setTouchStartY(e.touches[0].clientY);
    const handleTouchMove = (e) => {
      if (!touchStartY) return;
      const deltaY = touchStartY - e.touches[0].clientY;
      if (mediaFullyExpanded && deltaY < -20 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        e.preventDefault();
      } else if (!mediaFullyExpanded) {
        e.preventDefault();
        const scrollFactor = deltaY < 0 ? 0.008 : 0.005;
        const newProgress = Math.min(Math.max(scrollProgress + deltaY * scrollFactor, 0), 1);
        setScrollProgress(newProgress);
        if (newProgress >= 1) { setMediaFullyExpanded(true); setShowContent(true); }
        else if (newProgress < 0.75) setShowContent(false);
        setTouchStartY(e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => setTouchStartY(0);
    const handleScroll = () => { if (!mediaFullyExpanded) window.scrollTo(0, 0); };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [scrollProgress, mediaFullyExpanded, touchStartY]);

  useEffect(() => {
    const checkIfMobile = () => setIsMobileState(window.innerWidth < 768);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  const mediaWidth = 300 + scrollProgress * (isMobileState ? 650 : 1250);
  const mediaHeight = 400 + scrollProgress * (isMobileState ? 200 : 400);
  const textTranslateX = scrollProgress * (isMobileState ? 180 : 150);

  const firstWord = title ? title.split(" ")[0] : "";
  const restOfTitle = title ? title.split(" ").slice(1).join(" ") : "";

  const onImgError = (e) => {
    if (bgImageSrc && e.currentTarget.src !== bgImageSrc) e.currentTarget.src = bgImageSrc;
    else e.currentTarget.style.display = "none";
  };

  return (
    <div className="transition-colors duration-700 ease-in-out overflow-x-hidden bg-base text-ink">
      <section className="relative flex flex-col items-center justify-start min-h-[100dvh]">
        <div className="relative w-full flex flex-col items-center min-h-[100dvh]">
          {/* full-bleed background photo that fades as the media expands */}
          <m.div className="absolute inset-0 z-0 h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 - scrollProgress }} transition={{ duration: 0.1 }}>
            <img src={bgImageSrc} alt="" onError={onImgError} className="w-screen h-screen object-cover object-center" />
            <div className="absolute inset-0 bg-base/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-base/30 via-transparent to-base" />
          </m.div>

          <div className="container mx-auto flex flex-col items-center justify-start relative z-10">
            <div className="flex flex-col items-center justify-center w-full h-[100dvh] relative">
              {/* the expanding media tile */}
              <button
                type="button"
                onClick={() => { if (!mediaFullyExpanded) jumpToExpanded(); }}
                aria-label={mediaFullyExpanded ? undefined : enterLabel}
                className="absolute z-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden ring-1 ring-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
                style={{
                  width: `${mediaWidth}px`,
                  height: `${mediaHeight}px`,
                  maxWidth: "95vw",
                  maxHeight: "85vh",
                  boxShadow: "0px 0px 50px rgba(0,0,0,0.45)",
                  transition: REDUCED ? "none" : "width 0.08s linear, height 0.08s linear",
                }}
              >
                <img src={mediaSrc} alt={title || "Prana Venture"} onError={onImgError} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-base/70 via-base/20 to-base/30" />
              </button>

              {/* title overlay — two halves slide apart as the media opens */}
              <div className={`relative z-10 flex flex-col items-center text-center ${mediaFullyExpanded ? "pointer-events-none" : ""}`}>
                {date && (
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-soft mb-3" style={{ transform: `translateX(-${textTranslateX * 0.25}vw)` }}>
                    {date}
                  </p>
                )}
                <div className={`flex items-center justify-center gap-x-4 sm:gap-x-8 ${textBlend ? "mix-blend-difference" : ""}`}>
                  <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] leading-none" style={{ transform: `translateX(-${textTranslateX}vw)` }}>
                    {firstWord}
                  </h1>
                  <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] leading-none text-ink-soft" style={{ transform: `translateX(${textTranslateX}vw)` }}>
                    {restOfTitle}
                  </h1>
                </div>
                {!mediaFullyExpanded && (
                  <div className="mt-9 flex flex-col items-center gap-4">
                    <MetalButton variant="default" onClick={jumpToExpanded} className="pointer-events-auto px-8">
                      {enterLabel}
                    </MetalButton>
                    {scrollToExpand && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-dim">{scrollToExpand}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* revealed content (the sign-in form) */}
      <m.section
        ref={contentRef}
        className="relative z-10 flex flex-col items-center w-full px-6 pb-16 min-h-[100dvh] justify-center"
        animate={{ opacity: showContent ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        style={{ pointerEvents: showContent ? "auto" : "none" }}
      >
        {children}
      </m.section>
    </div>
  );
}
