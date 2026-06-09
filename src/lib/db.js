// src/lib/db.js
// Single import point for the UI. Chooses the real Supabase backend when the
// VITE_SUPABASE_* env vars are present, otherwise falls back to a local,
// in-browser demo data layer so the app runs with zero setup.
//
// The UI only ever imports { db, seedIfEmpty } from here — it never needs to
// know which implementation is active.

import * as supabaseImpl from "./supabaseClient";
import * as localImpl from "./localDb";

const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const MODE = configured ? "supabase" : "local";
export const db = configured ? supabaseImpl.db : localImpl.db;
export const seedIfEmpty = configured ? supabaseImpl.seedIfEmpty : localImpl.seedIfEmpty;

// PROD SAFETY: a production build with no Supabase config must NOT silently serve
// the in-browser demo data layer to real users. When this is true the app refuses
// to mount (see App.jsx) and shows a hard configuration error instead of demo data.
// Dev (`npm run dev`) is unaffected (import.meta.env.PROD is false), so the local
// demo still works for development; only the shipped production bundle enforces this.
export const CONFIG_ERROR = Boolean(import.meta.env.PROD && !configured);

if (typeof window !== "undefined") {
  if (CONFIG_ERROR) {
    console.error(
      "[PRANA] Production build is missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — " +
      "refusing to run in demo mode. Set both env vars and rebuild."
    );
  } else {
    console.info(`[PRANA] data layer: ${MODE}${configured ? "" : " (demo — set VITE_SUPABASE_* to go live)"}`);
  }
}
