// power.js — shared device-capability guards for the heavy visual layers.
//
// LOW_POWER: weak tablets, Save-Data, or ≤2-core / ≤2GB devices skip WebGL
// heroes entirely (Spline robot, three.js scenes). The shop-floor login must
// never jank or cook a cheap tablet. Evaluated once at module load — these
// device facts don't change mid-session.
export const LOW_POWER = (() => {
  if (typeof navigator === "undefined") return false;
  const c = navigator.connection;
  if (c && (c.saveData || /(^|\b)(slow-)?2g$/.test(c.effectiveType || ""))) return true;
  if (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2) return true;
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) return true;
  return false;
})();
