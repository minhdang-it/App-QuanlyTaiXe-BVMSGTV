-- Điều phối xe Bệnh viện mắt Sài Gòn Trà Vinh - Supabase schema
-- Chạy toàn bộ file trong Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Người dùng',
  phone text not null default '',
  role text not null default 'driver' check (role in ('driver','dispatcher','accountant','fleet','director','admin')),
  active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  vehicle_name text not null,
  vehicle_type text not null default 'Xe công ty',
  seats integer not null default 5 check (seats > 0),
  status text not null default 'available' check (status in ('available','in_use','maintenance','out_of_service')),
  odometer integer not null default 0 check (odometer >= 0),
  image_url text,
  regular_driver_id uuid references public.profiles(id) on delete set null,
  registration_expiry date,
  insurance_expiry date,
  next_maintenance_date date,
  next_maintenance_odometer integer,
  fuel_norm_l_per_100km numeric(6,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  purpose text not null check (purpose in ('patient_pickup','patient_return','community_exam','board_business','staff_transport','medicine_supply','marketing_care','administrative','personal_other')),
  pickup text not null,
  destination text not null,
  contact_name text,
  contact_phone text,
  passenger_count integer check (passenger_count is null or passenger_count >= 0),
  scheduled_start timestamptz not null,
  expected_end timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'assigned' check (status in ('assigned','accepted','ready','active','completed','cancelled')),
  notes text,
  checklist_completed boolean not null default false,
  start_odometer integer,
  end_odometer integer,
  start_odometer_image_url text,
  end_odometer_image_url text,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint start_odometer_nonnegative check (start_odometer is null or start_odometer >= 0),
  constraint end_odometer_nonnegative check (end_odometer is null or end_odometer >= 0),
  constraint odometer_order check (end_odometer is null or start_odometer is null or end_odometer >= start_odometer),
  constraint trip_time_order check (expected_end is null or expected_end > scheduled_start),
  constraint active_trip_requires_start check (
    status not in ('active','completed') or
    (checklist_completed and start_odometer is not null and start_odometer_image_url is not null and started_at is not null)
  ),
  constraint completed_trip_requires_end check (
    status <> 'completed' or
    (end_odometer is not null and end_odometer_image_url is not null and ended_at is not null)
  )
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_vehicle_time_no_overlap') then
    alter table public.trips add constraint trips_vehicle_time_no_overlap
      exclude using gist (vehicle_id with =, tstzrange(scheduled_start, coalesce(expected_end, scheduled_start + interval '1 hour'), '[)') with &&)
      where (status not in ('completed','cancelled'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_driver_time_no_overlap') then
    alter table public.trips add constraint trips_driver_time_no_overlap
      exclude using gist (driver_id with =, tstzrange(scheduled_start, coalesce(expected_end, scheduled_start + interval '1 hour'), '[)') with &&)
      where (status not in ('completed','cancelled'));
  end if;
end $$;

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  fuel_ok boolean not null,
  tires_ok boolean not null,
  lights_horn_ok boolean not null,
  vehicle_clean boolean not null,
  documents_ok boolean not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (trip_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  type text not null check (type in ('fuel','toll','parking','washing','repair','other')),
  amount numeric(14,2) not null check (amount > 0),
  fuel_liters numeric(10,2) check (fuel_liters is null or fuel_liters > 0),
  fuel_unit_price numeric(12,2) check (fuel_unit_price is null or fuel_unit_price > 0),
  description text,
  receipt_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  type text not null check (type in ('breakdown','collision','flat_tire','dashboard_warning','abnormal_noise','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  description text,
  image_url text,
  audio_url text,
  lat double precision,
  lng double precision,
  status text not null default 'reported' check (status in ('reported','handling','resolved')),
  handler_id uuid references public.profiles(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.maintenances (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  type text not null,
  description text,
  scheduled_date date,
  completed_date date,
  odometer integer,
  cost numeric(14,2),
  vendor text,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trips_driver_status_idx on public.trips(driver_id, status, scheduled_start);
create index if not exists trips_vehicle_time_idx on public.trips(vehicle_id, scheduled_start);
create index if not exists expenses_status_date_idx on public.expenses(status, expense_date);
create index if not exists incidents_status_idx on public.incidents(status, severity);
create index if not exists maintenance_vehicle_date_idx on public.maintenances(vehicle_id, scheduled_date);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at before update on public.trips for each row execute function public.set_updated_at();
drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();
drop trigger if exists maintenances_updated_at on public.maintenances;
create trigger maintenances_updated_at before update on public.maintenances for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Người dùng'),
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    'driver'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_management()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('dispatcher','accountant','fleet','director','admin'), false);
$$;

create or replace function public.can_dispatch()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('dispatcher','admin'), false);
$$;

create or replace function public.can_manage_fleet()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('dispatcher','fleet','admin'), false);
$$;

create or replace function public.can_review_expense()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('accountant','admin'), false);
$$;

create or replace function public.protect_trip_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  role_name text := public.current_role();
begin
  if role_name = 'driver' then
    if old.driver_id <> auth.uid() then
      raise exception 'Không có quyền cập nhật chuyến này';
    end if;
    if new.vehicle_id is distinct from old.vehicle_id
      or new.driver_id is distinct from old.driver_id
      or new.purpose is distinct from old.purpose
      or new.pickup is distinct from old.pickup
      or new.destination is distinct from old.destination
      or new.contact_name is distinct from old.contact_name
      or new.contact_phone is distinct from old.contact_phone
      or new.passenger_count is distinct from old.passenger_count
      or new.scheduled_start is distinct from old.scheduled_start
      or new.expected_end is distinct from old.expected_end
      or new.notes is distinct from old.notes
      or new.created_by is distinct from old.created_by then
      raise exception 'Tài xế không được sửa thông tin điều xe';
    end if;

    if new.status = 'ready' and exists (
      select 1 from public.checklists
      where trip_id = new.id and driver_id = auth.uid()
        and not (fuel_ok and tires_ok and lights_horn_ok and vehicle_clean and documents_ok)
    ) then
      raise exception 'Checklist có mục Không, cần điều phối duyệt ngoại lệ';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'assigned' and new.status = 'accepted') or
      (old.status = 'accepted' and new.status = 'ready') or
      (old.status = 'ready' and new.status = 'active') or
      (old.status = 'active' and new.status = 'completed')
    ) then
      raise exception 'Chuyển trạng thái chuyến không hợp lệ';
    end if;

    if new.checklist_completed = true and old.checklist_completed = false
      and not exists (select 1 from public.checklists where trip_id = new.id and driver_id = auth.uid()) then
      raise exception 'Chưa có checklist hợp lệ';
    end if;

    if (new.start_odometer is distinct from old.start_odometer or new.start_odometer_image_url is distinct from old.start_odometer_image_url) and old.status not in ('ready','active') then
      raise exception 'Chỉ được ghi kilomet đầu khi chuyến sẵn sàng';
    end if;
    if (new.end_odometer is distinct from old.end_odometer or new.end_odometer_image_url is distinct from old.end_odometer_image_url) and old.status <> 'active' then
      raise exception 'Chỉ được ghi kilomet cuối khi chuyến đang chạy';
    end if;

    if new.status = 'active' and (new.checklist_completed = false or new.start_odometer is null or new.start_odometer_image_url is null or new.started_at is null) then
      raise exception 'Cần checklist, ảnh kilomet đầu và thời gian xuất phát trước khi bắt đầu';
    end if;
    if new.status = 'completed' and (new.end_odometer is null or new.end_odometer_image_url is null or new.ended_at is null) then
      raise exception 'Cần ảnh kilomet cuối và thời gian kết thúc trước khi hoàn thành chuyến';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_trip_update_trigger on public.trips;
create trigger protect_trip_update_trigger before update on public.trips for each row execute function public.protect_trip_update();

create or replace function public.sync_trip_vehicle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and old.status is distinct from new.status then
    update public.vehicles set status = 'in_use' where id = new.vehicle_id;
  elsif new.status = 'completed' and old.status is distinct from new.status then
    update public.vehicles
      set status = 'available', odometer = greatest(odometer, coalesce(new.end_odometer, odometer))
      where id = new.vehicle_id;
  elsif new.status = 'cancelled' and old.status = 'active' then
    update public.vehicles set status = 'available' where id = new.vehicle_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_trip_vehicle_trigger on public.trips;
create trigger sync_trip_vehicle_trigger after update on public.trips for each row execute function public.sync_trip_vehicle();

create or replace function public.sync_maintenance_vehicle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'in_progress' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.vehicles set status = 'maintenance' where id = new.vehicle_id and status <> 'in_use';
  elsif new.status in ('completed','cancelled') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.vehicles set status = 'available' where id = new.vehicle_id and status = 'maintenance';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_maintenance_vehicle_trigger on public.maintenances;
create trigger sync_maintenance_vehicle_trigger after insert or update on public.maintenances for each row execute function public.sync_maintenance_vehicle();

create or replace function public.audit_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, table_name, record_id, action, old_data, new_data)
  values (auth.uid(), tg_table_name, coalesce(new.id, old.id)::text, tg_op, to_jsonb(old), to_jsonb(new));
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_trips on public.trips;
create trigger audit_trips after insert or update or delete on public.trips for each row execute function public.audit_change();
drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute function public.audit_change();
drop trigger if exists audit_incidents on public.incidents;
create trigger audit_incidents after insert or update or delete on public.incidents for each row execute function public.audit_change();
drop trigger if exists audit_vehicles on public.vehicles;
create trigger audit_vehicles after insert or update or delete on public.vehicles for each row execute function public.audit_change();

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.checklists enable row level security;
alter table public.expenses enable row level security;
alter table public.incidents enable row level security;
alter table public.maintenances enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles own or management read" on public.profiles;
create policy "profiles own or management read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_management());
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists "vehicles authenticated read" on public.vehicles;
create policy "vehicles authenticated read" on public.vehicles for select to authenticated using (true);
drop policy if exists "vehicles fleet insert" on public.vehicles;
create policy "vehicles fleet insert" on public.vehicles for insert to authenticated with check (public.can_manage_fleet());
drop policy if exists "vehicles fleet update" on public.vehicles;
create policy "vehicles fleet update" on public.vehicles for update to authenticated using (public.can_manage_fleet()) with check (public.can_manage_fleet());

drop policy if exists "trips own or management read" on public.trips;
create policy "trips own or management read" on public.trips for select to authenticated using (driver_id = auth.uid() or public.is_management());
drop policy if exists "trips dispatcher insert" on public.trips;
create policy "trips dispatcher insert" on public.trips for insert to authenticated with check (public.can_dispatch());
drop policy if exists "trips driver or dispatcher update" on public.trips;
create policy "trips driver or dispatcher update" on public.trips for update to authenticated using (driver_id = auth.uid() or public.can_dispatch()) with check (driver_id = auth.uid() or public.can_dispatch());

drop policy if exists "checklists own or management read" on public.checklists;
create policy "checklists own or management read" on public.checklists for select to authenticated using (driver_id = auth.uid() or public.is_management());
drop policy if exists "checklists driver insert" on public.checklists;
create policy "checklists driver insert" on public.checklists for insert to authenticated with check (
  driver_id = auth.uid() and exists (
    select 1 from public.trips t where t.id = checklists.trip_id and t.driver_id = auth.uid() and t.status = 'accepted'
  )
);

drop policy if exists "expenses own or management read" on public.expenses;
create policy "expenses own or management read" on public.expenses for select to authenticated using (driver_id = auth.uid() or public.is_management());
drop policy if exists "expenses driver insert" on public.expenses;
create policy "expenses driver insert" on public.expenses for insert to authenticated with check (
  driver_id = auth.uid() and (
    (expenses.trip_id is not null and exists (
      select 1 from public.trips t where t.id = expenses.trip_id and t.driver_id = auth.uid() and t.vehicle_id = expenses.vehicle_id
    )) or
    (expenses.trip_id is null and exists (
      select 1 from public.vehicles v where v.id = expenses.vehicle_id and v.regular_driver_id = auth.uid()
    ))
  )
);
drop policy if exists "expenses accountant update" on public.expenses;
create policy "expenses accountant update" on public.expenses for update to authenticated using (public.can_review_expense()) with check (public.can_review_expense());

drop policy if exists "incidents own or management read" on public.incidents;
create policy "incidents own or management read" on public.incidents for select to authenticated using (driver_id = auth.uid() or public.is_management());
drop policy if exists "incidents driver insert" on public.incidents;
create policy "incidents driver insert" on public.incidents for insert to authenticated with check (
  driver_id = auth.uid() and (
    (incidents.trip_id is not null and exists (
      select 1 from public.trips t where t.id = incidents.trip_id and t.driver_id = auth.uid() and t.vehicle_id = incidents.vehicle_id
    )) or
    (incidents.trip_id is null and exists (
      select 1 from public.vehicles v where v.id = incidents.vehicle_id and v.regular_driver_id = auth.uid()
    ))
  )
);
drop policy if exists "incidents fleet update" on public.incidents;
create policy "incidents fleet update" on public.incidents for update to authenticated using (public.can_manage_fleet()) with check (public.can_manage_fleet());

drop policy if exists "maintenances management read" on public.maintenances;
create policy "maintenances management read" on public.maintenances for select to authenticated using (public.is_management());
drop policy if exists "maintenances fleet insert" on public.maintenances;
create policy "maintenances fleet insert" on public.maintenances for insert to authenticated with check (public.can_manage_fleet());
drop policy if exists "maintenances fleet update" on public.maintenances;
create policy "maintenances fleet update" on public.maintenances for update to authenticated using (public.can_manage_fleet()) with check (public.can_manage_fleet());

drop policy if exists "audit admin director read" on public.audit_logs;
create policy "audit admin director read" on public.audit_logs for select to authenticated using (public.current_role() in ('admin','director'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-media', 'vehicle-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/webm','audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/aac','audio/ogg'])
on conflict (id) do update set public = false;

drop policy if exists "media authenticated read permitted folders" on storage.objects;
create policy "media authenticated read permitted folders"
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-media'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_management())
);

drop policy if exists "media upload own folder" on storage.objects;
create policy "media upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media update own folder" on storage.objects;
create policy "media update own folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media owner or admin delete" on storage.objects;
create policy "media owner or admin delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-media'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.current_role() = 'admin')
);

-- Bật realtime. Nếu bảng đã nằm trong publication, Supabase có thể báo trùng; khi đó bỏ qua câu tương ứng.
do $$
begin
  alter publication supabase_realtime add table public.trips;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.vehicles;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.incidents;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.maintenances;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.checklists;
exception when duplicate_object then null;
end $$;
