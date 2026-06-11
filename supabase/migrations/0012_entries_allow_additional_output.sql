-- 0012: Drop the over-strict duplicate guard on production entries.
--
-- The constraint uniq_entry (production_date, shift, component_id, operator_id)
-- made the second log of the same part, by the same operator, in the same shift
-- a HARD database error — but the UI explicitly invites it ("Confirm only if this
-- is additional output") and the local/demo data layer already allows N rows.
-- An entry is an *output event*, not a state: a part run on two machines, a
-- correction, or a second batch in one shift are all legitimate, and they SUM
-- correctly on the dashboard. Accidental double-submits are already guarded
-- client-side (the saving-lock + the confirm dialog), so the constraint only ever
-- blocked real work. Drop it; the soft "you already logged this" warning stays.
--
-- The supporting indexes (date / component / operator / date+shift) are kept —
-- they were created separately and still serve the dashboard's group-by queries.

alter table public.production_entries
  drop constraint if exists uniq_entry;
