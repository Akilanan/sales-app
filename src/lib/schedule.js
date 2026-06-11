// Phase 3: scheduling — sequence a machine's operations back-to-back (Sundays
// off) and assign each a start/end date, mirroring the Start Date / End Date
// columns in the HMC&VMC sheets. Auto-computed from the plan + operations + a
// month start; one machine runs one operation at a time, in plan order then
// op-no order.
import { opHours } from "./capacity";

const DAY_MS = 24 * 60 * 60 * 1000;

// Advance `days` (fractional) from a date, skipping Sundays (getDay()===0).
export function addWorkingDays(start, days) {
  let d = new Date(start);
  let remaining = Number(days) || 0;
  // never land/sit on a Sunday at the start
  while (d.getDay() === 0) d = new Date(d.getTime() + DAY_MS);
  let guard = 0;
  while (remaining > 1e-6 && guard < 100000) {
    guard++;
    const step = Math.min(remaining, 1);
    d = new Date(d.getTime() + step * DAY_MS);
    if (d.getDay() === 0) d = new Date(d.getTime() + DAY_MS); // hop over Sunday
    remaining -= step;
  }
  return d;
}

// Build the operation-level schedule for one machine.
// lines: machine_plan_lines for the machine; opsByComp: {componentId: [ops]};
// monthStr: 'YYYY-MM'. Returns rows with start/end Date objects.
export function scheduleMachine(lines, opsByComp, monthStr) {
  const [y, m] = String(monthStr).split("-").map(Number);
  let cursor = new Date(y, (m || 1) - 1, 1);
  while (cursor.getDay() === 0) cursor = new Date(cursor.getTime() + DAY_MS);

  const rows = [];
  for (const line of lines || []) {
    const ops = (opsByComp[line.component_id] || []).slice().sort((a, b) => a.op_no - b.op_no);
    for (const op of ops) {
      const days = opHours({ qty: line.qty, cycle_time: op.cycle_time, setup_time: op.setup_time, insertion_time: op.insertion_time }).days;
      const start = new Date(cursor);
      const end = addWorkingDays(start, days);
      rows.push({ component_id: line.component_id, op_no: op.op_no, description: op.description, qty: line.qty, days, start, end });
      cursor = new Date(end);
    }
  }
  return rows;
}

// Total span of the month for positioning bars (1st → last day).
export function monthBounds(monthStr) {
  const [y, m] = String(monthStr).split("-").map(Number);
  const first = new Date(y, (m || 1) - 1, 1);
  const last = new Date(y, m || 1, 0); // day 0 of next month = last day
  return { first, last, totalMs: last.getTime() - first.getTime() || DAY_MS };
}

export const fmtDate = (d) => d instanceof Date && !isNaN(d)
  ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
  : "—";
