// SplineScene — lazy wrapper around @splinetool/react-spline (pasted 21st.dev
// component, ported to this Vite+JSX project: TS stripped, 'use client' removed).
// The Spline runtime (~MBs) code-splits into its own chunk and loads only when
// this component mounts; the Suspense fallback keeps the panel calm meanwhile.
import React, { Suspense, lazy } from "react";

const Spline = lazy(() => import("@splinetool/react-spline"));

export function SplineScene({ scene, className, onLoad }) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-dim motion-safe:animate-pulse">
            CALIBRATING 3D…
          </span>
        </div>
      }
    >
      <Spline scene={scene} className={className} onLoad={onLoad} />
    </Suspense>
  );
}

export default SplineScene;
