// Capacity formulas — verified 1:1 against Akilan's HMC&VMC Excel sheets
// (every computed cell matched to 2 decimals across all rows).
//
//   MC Hrs = (qty*cycle + setup + insertion) / 60
//   LB Hrs = MC Hrs / 12
//   Total  = MC + LB
//   Eff    = Total * 1.05        ("Eff 95% / 1.05" adjustment)
//   Days   = Eff / 17            (3 shifts of ~17 productive hours/day)

export const HOURS_PER_DAY = 17;
export const EFF_FACTOR = 1.05;
export const LB_DIVISOR = 12;

// Hours/days for one operation producing `qty` pieces.
export function opHours({ qty = 0, cycle_time = 0, setup_time = 0, insertion_time = 60 }) {
  const mc = (Number(qty) * Number(cycle_time) + Number(setup_time) + Number(insertion_time)) / 60;
  const lb = mc / LB_DIVISOR;
  const total = mc + lb;
  const eff = total * EFF_FACTOR;
  const days = eff / HOURS_PER_DAY;
  return { mc, lb, total, eff, days };
}

// Roll a list of operations up to a component total at a given quantity.
export function componentCapacity(operations, qty) {
  return (operations || []).filter((o) => o.active !== false).reduce(
    (acc, o) => {
      const h = opHours({ qty, cycle_time: o.cycle_time, setup_time: o.setup_time, insertion_time: o.insertion_time });
      acc.mc += h.mc; acc.lb += h.lb; acc.total += h.total; acc.eff += h.eff; acc.days += h.days;
      return acc;
    },
    { mc: 0, lb: 0, total: 0, eff: 0, days: 0 }
  );
}

export const round1 = (n) => Math.round(Number(n) * 10) / 10 || 0;
export const round2 = (n) => Math.round(Number(n) * 100) / 100 || 0;
