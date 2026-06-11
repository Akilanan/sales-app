-- ============================================================================
-- 0009 · components.rate  (Phase 5 of the production-planning module)
--
-- Per-piece value/rate (₹) for a component. Drives the costing block from the
-- sheets: Amount = rate × qty; Hour-Rate = Amount / total hours; Targeted =
-- target_HR × hours; Loss = max(0, Targeted − Amount). Target HR (₹2200) is an
-- app constant for now.
-- ============================================================================
alter table public.components add column if not exists rate numeric not null default 0;
