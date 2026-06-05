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

if (typeof window !== "undefined") {
  // Handy hint in the browser console which backend is live.
  console.info(`[PRANA] data layer: ${MODE}${configured ? "" : " (demo — set VITE_SUPABASE_* to go live)"}`);
}
