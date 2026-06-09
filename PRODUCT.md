# Product

## Register

product

## Users

Two roles on a manufacturing shop floor, used 24/7:
- **Operators** — log production output after every shift on a wall/bench tablet via a numeric PIN. They are gloved, fast, glance-driven, often in low light. Primary task: record quantity + scrap for a component/machine/shift in under 20 seconds, with confidence it saved.
- **Supervisors / managers** — sign in with a password on desktop or tablet. Primary task: read "are we on track vs the monthly plan?" in 2 seconds, then drill into which components are behind and by how much, and maintain monthly targets / working days.

Context: a CNC components plant (railway, wind, marine parts). Real per-user passwords, on-prem-friendly, free stack. Output is recorded against the date the shift *started* (Shift 3 crosses midnight).

## Product Purpose

Daily production planning and Plan-vs-Actual tracking. It replaces a spreadsheet: operators log shift output, the system prorates each component's monthly target to an expected-to-date pace, and the dashboard surfaces deviation (behind / on / ahead) so a manager acts on the exceptions, not the noise. Success = the board is trusted enough to run the morning production meeting from it, and operators log every shift without being chased.

## Brand Personality

Precise, technical, commanding. A real-time **operations console**, not a consumer SaaS app. Voice is terse and functional (units, deltas, shift codes), never marketing. Three words: **instrument-grade, calm-under-load, exact**. The interface should feel like equipment a plant engineer trusts, not a dashboard a designer decorated.

## Anti-references

- Generic Inter-everywhere SaaS dashboards (Vercel-clone gradients, indigo pills, icon-in-a-tinted-box stat cards).
- Consumer rounded-pill progress bars and "friendly" oversized empty illustrations.
- The previous "looks AI-made" look the user repeatedly rejected.
- Gamer-RGB neon: cyan/violet are used as precise signal, never as glow-soup.
- Anything that hides density behind whitespace — operators need the numbers.

## Design Principles

1. **Color is exception, not decoration (HPHMI).** Neutral steel for on-plan; status hue (green/amber/red) only where there is something to act on. The accent (cyan) is reserved for the few sanctioned signals.
2. **Glance then drill.** Every screen answers its top question in one read (on-track? today's output? this entry saved?) before offering detail.
3. **Earned familiarity over surprise.** Same button, same control, same status vocabulary on every screen. The tool disappears into the task.
4. **Prorate honestly.** Compare actual against expected-to-date pace, never the full-month target mid-month, or everything reads false-critical.
5. **Built for the floor.** Reduced-motion, low-power tablet, gloved-tap (≥44px), and offline-tolerant by default — never desktop-only polish.

## Accessibility & Inclusion

WCAG AA minimum (AAA for primary numbers). Reduced-motion honored globally (MotionConfig + CSS belt). Status never by color alone (always a word + position). Touch targets ≥44px. Focus-visible rings on every control; confirm dialog is focus-trapped with Esc + focus restore. Tabular figures on all data. Tested on shop-floor tablet (low-power/save-data → static fallback, no WebGL).
