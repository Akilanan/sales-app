// Cursor.jsx — a bespoke, eased custom cursor (the igloo/lusion micro-interaction).
// An exact electric-blue point + a trailing ring that grows and fills over any
// interactive element. Desktop-mouse ONLY — coarse-pointer (shop-floor tablets)
// and reduced-motion users keep their native cursor untouched.
import { useEffect, useRef, useState } from "react";

const INTERACTIVE = 'button, a, input, textarea, select, label, [role="button"], [data-cursor]';

export default function Cursor() {
  const ring = useRef(null);
  const dot = useRef(null);
  const target = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const hovering = useRef(false);
  const down = useRef(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);
    document.documentElement.classList.add("cursor-none");

    const onMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      const t = e.target;
      hovering.current = !!(t && t.closest && t.closest(INTERACTIVE));
      if (ring.current) ring.current.style.opacity = "1";
      if (dot.current) dot.current.style.opacity = "1";
    };
    const onDown = () => { down.current = true; };
    const onUp = () => { down.current = false; };
    const onLeave = () => {
      if (ring.current) ring.current.style.opacity = "0";
      if (dot.current) dot.current.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("mouseleave", onLeave);

    let raf;
    const loop = () => {
      const t = target.current;
      if (dot.current) dot.current.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) translate(-50%, -50%)`;
      // eased trailing ring (light inertia)
      ringPos.current.x += (t.x - ringPos.current.x) * 0.16;
      ringPos.current.y += (t.y - ringPos.current.y) * 0.16;
      if (ring.current) {
        const scale = (hovering.current ? 1.7 : 1) * (down.current ? 0.78 : 1);
        ring.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) translate(-50%, -50%) scale(${scale})`;
        ring.current.style.borderColor = hovering.current ? "rgba(47,75,255,0.9)" : "rgba(236,239,244,0.38)";
        ring.current.style.background = hovering.current ? "rgba(47,75,255,0.10)" : "transparent";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.documentElement.classList.remove("cursor-none");
    };
  }, []);

  if (!enabled) return null;
  const base = { position: "fixed", top: 0, left: 0, zIndex: 100000, pointerEvents: "none", opacity: 0, willChange: "transform" };
  return (
    <>
      <div ref={ring} aria-hidden="true" style={{
        ...base, width: 30, height: 30, borderRadius: 9999,
        border: "1px solid rgba(236,239,244,0.38)",
        transition: "border-color 0.2s ease, background 0.2s ease, opacity 0.25s ease",
      }} />
      <div ref={dot} aria-hidden="true" style={{
        ...base, width: 5, height: 5, borderRadius: 9999, background: "#2F4BFF",
        transition: "opacity 0.25s ease",
      }} />
    </>
  );
}
