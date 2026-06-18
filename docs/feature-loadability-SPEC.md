# SPEC — Machine Loadability & Flexible Re-routing

**App:** Prana production-tracking (React + Vite + Supabase, live on Cloudflare). Feature-add to the existing Loading module — NOT a new build. Ship via Supabase migrations + redeploy, same as prior work.

**User:** managers/admins planning a month's machine loading (operators don't see this).

## Decisions (confirmed 2026-06-18)
1. **Loadable rule = capacity + OPTIONAL allowed-machines.** Always check free days. If a part has an explicit allowed-machines list, only those machines may run it; if it has none, ALL machines are allowed (works immediately, gets stricter as you restrict).
2. **Breakdown move = suggest → you confirm.** App ranks the free machines that can run each part (by spare capacity) and you one-click "Move" each, or "Move all".
3. **Splitting = yes.** A part's quantity can be split across multiple machines when no single one has room.
4. **Down scope = the whole selected month.** A machine marked down is removed from that month's capacity entirely.

## Grounding (current model — verified)
- Part load (days) = `componentCapacity(ops, qty).days` — 3-shift-equivalent days, machine-independent today.
- Machine capacity (days) = `working_days × shifts ÷ 3` (A81=24d, CWK 630=16d, Toyoda S55-1=8d).
- **Loadable ⇔ machine free days (capacity − already-loaded) ≥ part days.**
- `machine_plan_lines` ALREADY allows N lines per (machine, component) → splitting needs UI/logic, not a schema change.

## Core journeys
1. **Assign:** pick machine + part + qty on Loading → live **✓ loadable · X d spare** or **✗ over by Y d**, honoring allowed-machines. Each machine row shows load % / spare with a green→amber→red state.
2. **Breakdown:** mark a machine **down** for the month → its load → 0, capacity removed → the app lists each of its parts with a **ranked list of free machines** that can run it (capacity + allowed) → **Move** reassigns the plan line; **Move all** does the lot; if no single machine fits a part, offer a **split** across the top free machines.
3. **Flex:** when assigning/moving, if one machine is short, suggest splitting the qty across machines.

## Non-goals (v1)
- Per-machine processing speeds (load stays component-driven, machine-independent).
- Partial-month / date-range downtime (month-level only).
- Auto-optimization across the whole fleet (suggest-and-confirm, not a solver).
- Operator-facing changes.

## Acceptance check (E2E, demonstrated in the live app)
On Loading for a month: picking machine+part+qty shows a correct loadable/over indicator with spare/over days, respecting any allowed-machines restriction. Marking a machine **down** drops its capacity to 0, lists each assigned part with a ranked set of fittable free machines, and **Move** (or split) reassigns the plan line(s) — verified against the DB, then cleaned up.
