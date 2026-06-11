# DATA-ACCURACY AUDIT â€” Excel ground truth vs config vs live Supabase vs local demo seed
Sources verified: `06. June-HMC&VMC - 2026.xls` (sheets: `VMC - 01`, `a51 HMC - 01`, `Sheet1`, ` A . P`, `MM GEARS`, `ACE` â€” last 3 are 2017-era legacy reference tabs, ignored), `05. MAY-HMC&VMC - 2026.xls`, `3month June July Aug-HMC&VMC.xls`, `supabase/company.config.json`, `src/lib/localDb.js`, `src/lib/capacity.js`, live Supabase project `czfhyqvpfulpwpsgempf` (prana-venture-production). Live DB is read-only audited; nothing modified.

## (A) MACHINES

| # | Excel Sheet1 (June file) | Excel shifts | Excel maint./avail days | config.json | Live DB `machines` | Live shifts | localDb demo seed | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | A81 | 3 | 13.5 | A81 | A81 (wd 24) | 3 | â€” | match (avail days lost) |
| 2 | CWK 630 | **2** | 24 | CWK 630 | CWK 630 | **3 âœ—** | â€” | shift MISMATCH |
| 3 | CWK 800 | 3 | 24 | CWK 800 | CWK 800 | 3 | â€” | match |
| 4 | Toyoda800 | 3 | 24 | Toyoda800 | Toyoda800 | 3 | â€” | match |
| 5 | Toyoda 1000 | 3 | 24 | Toyoda 1000 | Toyoda 1000 | 3 | â€” | match |
| 6 | Toyoda S55-1 | **1** | 24 | Toyoda S55-1 | Toyoda S55-1 | **3 âœ—** | â€” | shift MISMATCH |
| 7 | Toyoda S55-2 | **2** | 24 | Toyoda S55-2 | Toyoda S55-2 | **3 âœ—** | â€” | shift MISMATCH |
| 8 | Toyoda630-1 | 3 | 24 | Toyoda630-1 | Toyoda630-1 | 3 | â€” | match |
| 9 | Toyoda630-2 | 3 | 24 | Toyoda630-2 | Toyoda630-2 | 3 | â€” | match |
| 10 | DMG MORI-1 | 3 | 24 | DMG MORI-1 | DMG MORI-1 | 3 | â€” | match |
| 11 | DMG MORI-2 | 3 | 24 | DMG MORI-2 | DMG MORI-2 | 3 | â€” | match |
| 12 | MCB-1 HMC-12 | 3 | **19** | MCB-1 HMC-12 | MCB-1 HMC-12 (wd 24) | 3 | â€” | match (avail days 19 lost) |
| 13 | MCB-2 HMC-13 | 3 | 24 | MCB-2 HMC-13 | MCB-2 HMC-13 | 3 | â€” | match |
| 14 | VMC-1 | 3 | 24 | VMC-1 | VMC-1 | 3 | â€” | match |
| 15 | VMC-2 | 3 | 24 | VMC-2 | VMC-2 | 3 | â€” | match |
| â€” | â€” | â€” | â€” | â€” | â€” | â€” | **CNC-01..CNC-04 (FAKE)** | demo seed 100% fake |

All 15 real machine names confirmed in Excel `Sheet1` and identical in config + live DB. **3 machines have wrong `shifts` in live DB (all seeded as 3): CWK 630 should be 2, Toyoda S55-1 should be 1, Toyoda S55-2 should be 2.** Excel's per-machine "Maintenance Availability Days" (A81=13.5, MCB-1=19) has no column in live DB. Live `machines` has no rate column (rate is hardcoded in capacity.js).

## (B) COMPONENTS + JUNE TARGET QTY

| Code | Name (live/config) | June Excel plan qty (machine tabs) | 3-month file June qty | May file qty | config target | Live `monthly_plans` 2026-06 | Demo seed | Provenance of live number |
|---|---|---|---|---|---|---|---|---|
| 1159 | Bearing Casing 1159 | **224** (140+84 batches, a51 HMC-01) | **150** | 85+81 | 150 | 150 / wd 24 | â€” | 3-month file, NOT the June monthly file (which says 224) |
| 5712 | Clamping Plate DE 5712 | **50** (VMC-01) | 75 | **91** (a May ACTUAL row) | 91 | 91 / wd 24 | â€” | **May actual qty used as June target â€” no June source says 91** |
| 5713 | Clamping Plate DE 5713 | **40** (VMC-01) | 75 | 75 | 75 | 75 / wd 24 | â€” | 3-month file + Sheet1 note "5713 100NOS production plan 75nos only" |
| E191 | E191 Cover | **24** (14+10, VMC-01 plan) | â€” | â€” | 20 | 20 / wd 24 | â€” | June ACTUAL row (qty 20), not the plan rows (24) |
| SPX | SPX Flow (Dev) | **absent** (only Sheet1 note) | â€” | 5 (May actual) | 5 | 5 / wd 24 | â€” | May file only |
| 5048A | 5048A Housing Cover (Dev) | **absent** | â€” | 1+4 (May plan) | 4 | 4 / wd 24 | â€” | May file only |
| 4797 | Largest Shield 4797 (Rabwin) | **1** (a51 HMC-01) | â€” | â€” | 1 | 1 / wd 24 | â€” | June file âœ“ exact |
| 4798 | Bearing Shield 4798 (Rabwin) | **1** (a51 HMC-01) | â€” | â€” | 1 | 1 / wd 24 | â€” | June file âœ“ exact |
| â€” | â€” | â€” | â€” | â€” | â€” | â€” | CP-100=1240, WHF-22=760, MC-07=425, RAB-15=980, WBR-09=612 (**ALL FAKE**, fake wd 24/25/26) | demo seed fake |

config.json == live DB exactly (8 parts, same codes/names/targets, wd 24). But the live targets are a **blend of three different workbooks**: 4797/4798 match June; 1159/5713 come from the 3-month plan (June file itself plans 1159=224, 5713=40); 5712=91 is a May ACTUAL; E191=20 is a June actual row vs plan 24; SPX/5048A exist only in May. The June file only carries detail tabs for 2 of 15 machines (VMC-01 + a51 HMC-01), so full-factory June targets cannot all come from it. `components.rate` = 0 for all 8 in live DB (Excel Rate column is blank on June part rows; legacy tabs show rates were used historically) â†’ all costing/HR/loss numbers in the app compute as â‚¹0.

## (C) OPERATIONS (routing rows)

| Code | Excel op rows (June file) | cy/set per op (June) | Excel (May/3-mon variants) | Live `component_operations` | Match? |
|---|---|---|---|---|---|
| 1159 | 4 (40,50,60,70) | 28/56, 38/76, 6/12, 6/12 | 3-mon: cy 40/45/10/10, set 80/90/20/20; May plan: 40/80,45/90,10/20,10/20 | 4 ops: 28/56, 38/76, 6/12, 6/12 | âœ“ June file version |
| 4797 | 2 (30,40) | 93/1330, 61/730 | â€” | 2 ops: 93/1330, 61/730 | âœ“ exact |
| 4798 | 2 (30,40) | 126/1300, 52/680 | â€” | 2 ops: 126/1300, 52/680 | âœ“ exact |
| 5713 | 1 (40) | 103/480 | May+3-mon: 120/480 | 1 op: 103/480 | âœ“ June plan row |
| 5712 | 1 (40) | plan: 120/**480**; actual row: 120/240 | May+3-mon: 145/290 | 1 op: 120/**240** | âš  setup taken from June ACTUAL row, plan says 480 |
| E191 | 1 op code, 2 plan rows | plan: 60/**1160** and 60/480; actual: 60/180 | â€” | 1 op: 60/**180** | âš  setup taken from June ACTUAL row; plan setups (1160/480) dropped |
| 5048A | 0 in June; **3 in May** (20,30,40) | May: 60/180, 50/150, 30/90 | â€” | **0 ops** | âœ— MISSING (May routing exists) |
| SPX | 0 in June; **1 in May** (20) | May: 130/800 | â€” | **0 ops** | âœ— MISSING (May routing exists) |

Total live ops = **11** across 6/8 parts â€” memory confirmed. All insertion_time = 60 (matches Excel "Ins. Time" 60 on every current row). Demo seed has **zero** operations.

## (D) SETTINGS / CONSTANTS

| Setting | Excel (June file) | Live DB | capacity.js | localDb demo | Verdict |
|---|---|---|---|---|---|
| Working days | 24 (all 15 machines, Sheet1) | `machines.working_days` = 24 âœ“; `monthly_plans.working_days` = 24 âœ“ | â€” | fake 24/25/26 | OK (demo wrong) |
| Shifts | per-machine 1/2/3 (Sheet1) | `machines.shifts` = 3 for ALL | HOURS_PER_DAY=17 (â‰ˆ3 shifts) | hardcoded SHIFTS=[1,2,3] | **3 machines wrong in live; per-machine shift capacity overstated** |
| Target HR | 2200 (both machine tabs, col "Target HR") | `app_settings.target_hr` = "2200" âœ“ | TARGET_HR = 2200 âœ“ | getSettings default "2200" âœ“ | OK everywhere |
| Machine hour rate | 1200 ("Machine Hour rate 1200", VMC-01 tab) | **absent from app_settings & machines** | MACHINE_RATE = 1200 âœ“ (hardcoded) | absent | OK numerically, but not editable/persisted in DB |
| Eff factor | column "Eff 95%" Ã— **1.05**; header label "Target efficiency 92%" | absent | EFF_FACTOR = 1.05 âœ“ (matches the math actually used in sheet) | absent | OK â€” note 92% is a label, 1.05 is the real multiplier |
| LB hours | MC/12 | â€” | LB_DIVISOR = 12 âœ“ | â€” | OK |
| Component rates (â‚¹/pc) | blank on June rows (legacy tabs had them) | components.rate = 0 all | â€” | â€” | Costing outputs â‚¹0 until rates entered |

## (E) VERDICT

**Real where:** Live Supabase = the only surface with real factory data: 15 real machine names âœ“, 8 real part codes/names âœ“, June 2026 monthly_plans for all 8 âœ“, 11 routing ops with timings that match the June workbook rows they were lifted from âœ“, target_hr 2200 âœ“. config.json mirrors live exactly (it was the seed).

**Fake / wrong where:**
1. **Local demo seed (`src/lib/localDb.js`) is 100% fictional** â€” CNC-01..04, CP-100/WHF-22/MC-07/RAB-15/WBR-09, fake targets 1240/760/425/980/612, fake users. Anyone running the app without Supabase env sees a different factory than the real one.
2. **Live `machines.shifts` is wrong for 3 machines** (CWK 630â†’2, Toyoda S55-1â†’1, Toyoda S55-2â†’2; all stored as 3) â†’ per-machine capacity/Loading screens overstate available hours on those machines.
3. **Live June targets are a cross-workbook blend, not the June file**: 1159 live=150 vs June-file plan 224 (3-month file says 150); 5713 live=75 vs June-file 40; 5712 live=91 (only traceable to a MAY actual row; June plan=50, 3-month=75); E191 live=20 vs June plan 24. If the user opens "06. June" Excel side-by-side with the app, these four WILL look different â€” that is the discrepancy he's seeing, and it's a provenance choice, not an import bug. 4797/4798 are exact.
4. **5712 & E191 setup times** in live ops were taken from June ACTUAL rows (240, 180) not the plan rows (480; 1160/480) â†’ planned hours in app run lower than the Excel plan section.
5. **Missing in live:** 5048A routing (3 ops in May file: 20=60/180, 30=50/150, 40=30/90) and SPX routing (May: op 20=130/800); machine hour rate 1200 not in `app_settings` (hardcoded only in capacity.js); per-machine maintenance-availability days (A81=13.5, MCB-1=19) not modeled; all `components.rate`=0 so costing/HR/loss = â‚¹0; 0 operators in `users` (only admin akilan), 0 production_entries, 0 machine_plan_lines â€” dashboard "actuals" are empty in live.

**Minimal change list:**
- *(1) Make demo seed mirror the real factory* â€” in `src/lib/localDb.js` `seedIfEmpty()`: replace the 4 fake machines with the 15 real codes (with per-machine `shifts` 2/1/2 for CWK 630/S55-1/S55-2), replace the 5 fake components with the 8 real ones + June targets (150/91/75/20/5/4/1/1, wd 24), and seed the 11 real `component_operations` rows so Loading/costing work in demo. Keep fake people (real PINs must come from Akilan).
- *(2) Fix live data* â€” `UPDATE machines SET shifts=2 WHERE code='CWK 630'; shifts=1 WHERE code='Toyoda S55-1'; shifts=2 WHERE code='Toyoda S55-2';` Â· insert 5048A's 3 ops + SPX's 1 op from the May file Â· add `app_settings.machine_rate=1200` (and read it in capacity.js instead of the constant) Â· get Akilan to confirm intended June targets for 1159 (150 vs 224) and 5712 (91 vs 50/75) and the intended setup times for 5712 (240 vs 480) / E191 (180 vs 480/1160) â€” both versions exist in his own sheets Â· enter component rates (â‚¹/pc) to activate costing Â· add real operators.

Key paths: `c:\Users\12aki\Downloads\prana-production-app\06. June-HMC&VMC - 2026.xls`, `c:\Users\12aki\Downloads\prana-production-app\05. MAY-HMC&VMC - 2026.xls`, `c:\Users\12aki\Downloads\prana-production-app\3month June July Aug-HMC&VMC.xls`, `c:\Users\12aki\Downloads\prana-production-app\supabase\company.config.json`, `c:\Users\12aki\Downloads\prana-production-app\src\lib\localDb.js` (fake seed, lines 50-65), `c:\Users\12aki\Downloads\prana-production-app\src\lib\capacity.js` (TARGET_HR/MACHINE_RATE lines 41-42). Live project: `czfhyqvpfulpwpsgempf`.
