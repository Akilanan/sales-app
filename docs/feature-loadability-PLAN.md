# PLAN — Machine Loadability & Flexible Re-routing

Ships in deployable slices. Stack: React+Vite+Supabase (existing app). Each slice verified live, then committed.

## New module: `src/lib/loadability.js`
Pure functions (unit-testable, machine-independent days model):
- `machineCapacityDays(m)` = `(m.working_days||24) × (m.shifts||3)/3` (extracted from inline `wd`).
- `machineLoad(machineId, machinePlan, ops)` = existing `machineLoadDays` (reuse).
- `partDays(ops, qty)` = `componentCapacity(ops, qty).days` (reuse).
- `daysModel(ops)` → `{ per, fixed }` where `days(qty) = per·qty + fixed` (linear: `fixed=partDays(ops,0)`, `per=partDays(ops,1)−fixed`). Lets us invert days→qty.
- `maxQtyForDays(ops, spareDays)` = `per>0 ? floor((spareDays−fixed)/per) : Infinity` (≥0).
- `loadability(machine, ops, qty, machinePlan, downSet)` → `{ loadable, spare, partDays, over }` (down ⇒ cap 0).
- `allowedFor(componentId, componentMachines, machines)` → machines allowed (none set ⇒ all).
- `suggestMachines(part, qty, ctx)` → fittable, allowed, up, non-source machines ranked by **spare desc** (least-loaded first). 
- `suggestSplit(part, qty, ctx)` → greedy fill across ranked machines using `maxQtyForDays` until qty placed; returns `[{machineId, qty}]` + `unplaced`.

## DB (Supabase migrations)
- `0016_machine_breakdowns.sql`: `machine_breakdowns(machine_id uuid refs machines, month date, note text, created_at timestamptz default now(), primary key(machine_id,month))`. RLS: SELECT for authenticated; INSERT/DELETE for managers (`current_app_role() in ('supervisor','admin')`). A row = that machine is DOWN for that month.
- `0017_component_machines.sql`: `component_machines(component_id uuid refs components, machine_id uuid refs machines, primary key(component_id,machine_id))`. RLS same. Any row(s) for a component ⇒ ONLY those machines allowed; none ⇒ all allowed.

## db methods (supabaseClient.js + localDb.js parity)
- `listBreakdowns(month)`, `setMachineDown(machineId, month)`, `clearMachineDown(machineId, month)`.
- `listAllowedMachines()`, `addAllowedMachine(componentId, machineId)`, `removeAllowedMachine(componentId, machineId)`.
- Reassign reuses `updateMachinePlanLine(id,{machine_id,seq})`; split = update kept qty + `addMachinePlanLine` for spill.
- Add `breakdowns` + `componentMachines` to `loadData()` fetch → `data.breakdowns`, `data.componentMachines`.

## Slices
1. **Loadability preview** (no schema): on the add-line panel, live `✓ Loadable · N d spare` / `✗ Over by M d` for the chosen machine+part+qty; warn (don't hard-block — overbooking is already allowed). Ship + verify.
2. **Machine down + breakdown reassignment** (0016 + loadability.js + BreakdownPanel): "Mark down"/"Back up" per machine; down ⇒ cap 0, greyed, badge; panel lists each part on the down machine with ranked free-machine suggestions + **Move** / **Move all** / **Split** (greedy). Ship + verify.
3. **Allowed-machines** (0017): per-part "runs on" multi-select in Plan Setup/Routing; enforce in loadability + suggestions (incompatible machines excluded/blocked). Ship + verify.

## Acceptance (live, then clean up scratch data)
Pick machine+part+qty → correct loadable/over with spare. Mark a machine down → cap 0, its parts listed with ranked fittable free machines → Move reassigns the line (DB-verified); when none fit whole, Split distributes qty across machines. Allowed-machines restriction hides/blocks incompatible machines.
