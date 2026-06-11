-- ============================================================================
-- 0011 · covering indexes for foreign keys (perf advisor cleanup)
-- INFO-level at this data volume, but free and good practice.
-- ============================================================================
create index if not exists entry_audit_changed_by_idx        on public.entry_audit (changed_by);
create index if not exists machine_plan_lines_component_idx   on public.machine_plan_lines (component_id);
create index if not exists machine_plan_lines_machine_idx     on public.machine_plan_lines (machine_id);
create index if not exists monthly_plans_component_idx        on public.monthly_plans (component_id);
create index if not exists production_entries_created_by_idx  on public.production_entries (created_by);
create index if not exists production_entries_machine_idx     on public.production_entries (machine_id);
