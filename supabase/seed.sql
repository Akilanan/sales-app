-- ============================================================================
-- seed.sql  ·  Demo data matching the MVP. Run AFTER 0001 + 0002.
--
-- NOTE: creating Supabase Auth users from raw SQL touches the internal `auth`
-- schema, whose columns vary slightly between Supabase versions. If PART A
-- errors, comment it out and create the 5 demo users with seed.mjs (or the
-- dashboard: Authentication -> Add user) instead — PART B will still work.
-- Demo logins created here:
--   Operators (PIN):  1001 Ravi · 1002 Suresh · 1003 Lakshmi
--   Managers:         anita@prana.app / anita123  ·  admin@prana.app / admin123
-- ============================================================================

-- ====================== PART A — Auth users + profiles ======================
do $$
declare
  v_op1 uuid := gen_random_uuid();
  v_op2 uuid := gen_random_uuid();
  v_op3 uuid := gen_random_uuid();
  v_sup uuid := gen_random_uuid();
  v_adm uuid := gen_random_uuid();
  v_secret text := 'prana-operator-v1';   -- MUST match OPERATOR_SECRET in supabaseClient.js
begin
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_op1, 'authenticated','authenticated','1001@operator.prana.app', crypt('1001'||v_secret, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
    ('00000000-0000-0000-0000-000000000000', v_op2, 'authenticated','authenticated','1002@operator.prana.app', crypt('1002'||v_secret, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
    ('00000000-0000-0000-0000-000000000000', v_op3, 'authenticated','authenticated','1003@operator.prana.app', crypt('1003'||v_secret, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
    ('00000000-0000-0000-0000-000000000000', v_sup, 'authenticated','authenticated','anita@prana.app',         crypt('anita123', gen_salt('bf')),       now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
    ('00000000-0000-0000-0000-000000000000', v_adm, 'authenticated','authenticated','admin@prana.app',         crypt('admin123', gen_salt('bf')),       now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','','');

  insert into auth.identities
    (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_op1, jsonb_build_object('sub', v_op1::text, 'email','1001@operator.prana.app'), 'email', v_op1::text, now(), now(), now()),
    (gen_random_uuid(), v_op2, jsonb_build_object('sub', v_op2::text, 'email','1002@operator.prana.app'), 'email', v_op2::text, now(), now(), now()),
    (gen_random_uuid(), v_op3, jsonb_build_object('sub', v_op3::text, 'email','1003@operator.prana.app'), 'email', v_op3::text, now(), now(), now()),
    (gen_random_uuid(), v_sup, jsonb_build_object('sub', v_sup::text, 'email','anita@prana.app'),         'email', v_sup::text, now(), now(), now()),
    (gen_random_uuid(), v_adm, jsonb_build_object('sub', v_adm::text, 'email','admin@prana.app'),         'email', v_adm::text, now(), now(), now());

  insert into public.users (id, name, role, login_code, active) values
    (v_op1, 'Ravi Kumar',   'operator',   '1001', true),
    (v_op2, 'Suresh Patil', 'operator',   '1002', true),
    (v_op3, 'Lakshmi Devi', 'operator',   '1003', true),
    (v_sup, 'Anita Rao',    'supervisor', null,   true),
    (v_adm, 'Admin',        'admin',      null,   true);
end $$;

-- ====================== PART B — App data ===================================
-- Machines
insert into public.machines (code, name) values
  ('CNC-01','CNC-01'), ('CNC-02','CNC-02'), ('CNC-03','CNC-03'), ('CNC-04','CNC-04')
on conflict (code) do nothing;

-- Components
insert into public.components (code, name, industry) values
  ('CP-100','Clamping Plate','railway'),
  ('WHF-22','Wind Hub Flange','wind'),
  ('MC-07','Marine Coupling','marine'),
  ('RAB-15','Rail Axle Bush','railway'),
  ('WBR-09','Wind Brake Disc','wind')
on conflict (code) do nothing;

-- Monthly plan for the current month
insert into public.monthly_plans (month, component_id, target_qty, working_days)
select date_trunc('month', current_date)::date, c.id, v.target, 26
from (values
  ('CP-100',200), ('WHF-22',120), ('MC-07',80), ('RAB-15',300), ('WBR-09',150)
) as v(code, target)
join public.components c on c.code = v.code
on conflict (month, component_id)
  do update set target_qty = excluded.target_qty, working_days = excluded.working_days;

-- ~1 week of production entries (skips tonight's Shift 3)
insert into public.production_entries
  (production_date, shift, component_id, machine_id, operator_id, quantity, scrap_qty)
select
  d::date,
  s.shift,
  c.id,
  (select id from public.machines order by random() limit 1),
  (select id from public.users where role = 'operator' order by random() limit 1),
  greatest(0, round((mp.target_qty::numeric / mp.working_days / 3) * (0.7 + random() * 0.6)))::int,
  (case when random() < 0.2 then 1 else 0 end)
from generate_series(current_date - interval '6 days', current_date, interval '1 day') as d
cross join (values (1), (2), (3)) as s(shift)
join public.components c on c.active
join public.monthly_plans mp
  on mp.component_id = c.id and mp.month = date_trunc('month', current_date)::date
where not (d::date = current_date and s.shift = 3)
on conflict on constraint uniq_entry do nothing;
