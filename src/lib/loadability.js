// ============================================================================
// loadability.js — machine loadability + flexible re-routing.
//
// Days are 3-shift-equivalent (same unit as capacity.js): a part's load is
// MACHINE-INDEPENDENT and LINEAR in qty (per-piece run time + a fixed setup),
// so days(qty) = per·qty + fixed — which lets us invert days↔qty for splitting.
//
// Core math here is pure model (no policy). The POLICY bits (utilisation tone
// thresholds, the suggestion ranking, split granularity) are isolated at the
// bottom and tuned from the deep-research synthesis.
// ============================================================================
import { componentCapacity } from "./capacity";

const MACHINE_DAYS = 24; // default working days/month
// Planning factor (availability buffer ON TOP of the ×1.05/17h efficiency already
// baked into capacity.js days). Research: load to ~90%, NOT 100% — queueing/lead-
// time blows up near the ceiling (Kingman). 0.90 (not 0.85) avoids double-counting
// the efficiency factors capacity.js already applies. Editable via app_settings.
export const DEFAULT_PLANNING_FACTOR = 0.9;

// One machine's RATED capacity in 3-shift-equiv days = working_days × shifts/3.
// NOT rounded — compare on raw days, round only at display (sub-0.1d rounding
// must not flip a loadable/over verdict).
export const machineCapacityDays = (m) =>
  (m?.working_days || MACHINE_DAYS) * ((m?.shifts || 3) / 3);

// Plannable capacity = rated × planning factor (the line you actually load to).
export const plannableCapacity = (m, factor = DEFAULT_PLANNING_FACTOR) =>
  machineCapacityDays(m) * factor;

// Days a part needs at a quantity.
export const partDays = (ops, qty) => componentCapacity(ops, qty).days;

// Total loaded days on a machine (sum of its plan lines).
export function machineLoadDaysOf(machineId, machinePlan, operations) {
  let days = 0;
  for (const l of (machinePlan || []).filter((x) => x.machine_id === machineId)) {
    const ops = (operations || []).filter((o) => o.component_id === l.component_id);
    days += partDays(ops, l.qty);
  }
  return days;
}

// days(qty) = per·qty + fixed.  fixed = setup/insertion overhead, per = per-piece run.
export function daysModel(ops) {
  const fixed = partDays(ops, 0);
  const per = partDays(ops, 1) - fixed;
  return { per: per > 0 ? per : 0, fixed: fixed > 0 ? fixed : 0 };
}

// Largest whole qty whose load fits within `spareDays` (≥0).
export function maxQtyForDays(ops, spareDays) {
  if (spareDays <= 0) return 0;
  const { per, fixed } = daysModel(ops);
  if (per <= 0) return spareDays >= fixed ? Infinity : 0;
  return Math.max(0, Math.floor((spareDays - fixed) / per));
}

export const isDown = (machineId, downSet) => !!(downSet && downSet.has && downSet.has(machineId));

// Machines a component MAY run on: its explicit allow-list if any rows exist,
// else ALL active machines (all-allowed default).
export function allowedMachines(componentId, componentMachines, machines) {
  const ids = (componentMachines || []).filter((cm) => cm.component_id === componentId).map((cm) => cm.machine_id);
  const active = (machines || []).filter((m) => m.active !== false);
  if (!ids.length) return active;
  const set = new Set(ids);
  return active.filter((m) => set.has(m.id));
}
export const isAllowedOn = (componentId, machineId, componentMachines) => {
  const ids = (componentMachines || []).filter((cm) => cm.component_id === componentId).map((cm) => cm.machine_id);
  return ids.length === 0 || ids.includes(machineId);
};

// --- POLICY (tuned from the deep-research synthesis) ------------------------

// Utilisation tone. Load to the planning line (amber, default 90%), red over the
// hard ceiling (100%). pct null ⇒ no capacity configured.
export function utilTone(pct, { amber = 90, red = 100 } = {}) {
  if (pct == null) return "none";
  if (pct > red) return "over";
  if (pct > amber) return "tight";
  return "ok";
}

// Loadability of placing `qty` of a part on one machine. `free` is spare vs the
// PLANNABLE line; `over` is overload vs the hard RATED ceiling. Over-capacity is
// ALLOWED (never hard-blocked) — the planner sees red and rebalances.
export function loadability({ machine, ops, qty, machinePlan, operations, downSet, factor = DEFAULT_PLANNING_FACTOR, thresholds }) {
  const down = isDown(machine.id, downSet);
  const rated = down ? 0 : machineCapacityDays(machine);
  const plan = rated * factor;
  const load = machineLoadDaysOf(machine.id, machinePlan, operations);
  const need = partDays(ops, qty);
  const newLoad = load + need;
  const utilPct = rated > 0 ? Math.round((newLoad / rated) * 100) : null; // null ⇒ no capacity configured
  return {
    down, rated, plan, load, need, newLoad,
    free: Math.max(0, plan - newLoad),       // GREEN spare vs the planning line, after adding
    over: Math.max(0, newLoad - rated),      // RED overload vs the hard ceiling
    spare: rated - load,                     // raw headroom before adding
    after: rated - newLoad,                  // raw headroom after (negative = over ceiling)
    loadable: rated - newLoad >= -1e-6,      // fits under the hard ceiling
    utilPct,
    tier: rated === 0 ? "none" : utilTone(utilPct, thresholds), // ok | tight | over | none
  };
}

// Rank machines that can run a part by MOST SPARE first (least-loaded → balances
// utilisation; the explainable default). Excludes the source/down machines.
export function suggestMachines({ componentId, ops, qty, machines, machinePlan, operations, componentMachines, downSet, excludeId }) {
  const need = partDays(ops, qty);
  return allowedMachines(componentId, componentMachines, machines)
    .filter((m) => m.id !== excludeId && !isDown(m.id, downSet))
    .map((m) => {
      const cap = machineCapacityDays(m);
      const load = machineLoadDaysOf(m.id, machinePlan, operations);
      const spare = cap - load;
      return { machine: m, cap, load, spare, after: spare - need, fits: spare - need >= -1e-6 };
    })
    .sort((a, b) => (b.spare - a.spare) || String(a.machine.id).localeCompare(String(b.machine.id))); // most-spare (least-loaded) first; stable tie-break so suggestions never flicker
}

// Greedy SPLIT: fill the most-spare eligible machines first (up to each one's
// capacity) until the whole qty is placed; report any unplaced remainder.
export function suggestSplit({ componentId, ops, qty, machines, machinePlan, operations, componentMachines, downSet, excludeId }) {
  const cands = suggestMachines({ componentId, ops, qty, machines, machinePlan, operations, componentMachines, downSet, excludeId });
  const alloc = [];
  let remaining = qty;
  for (const c of cands) {
    if (remaining <= 0) break;
    const fit = maxQtyForDays(ops, c.spare);
    const take = Math.min(remaining, fit === Infinity ? remaining : fit);
    if (take > 0) { alloc.push({ machine: c.machine, qty: take, days: partDays(ops, take) }); remaining -= take; }
  }
  return { alloc, unplaced: Math.max(0, remaining) };
}
