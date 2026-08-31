-- BVMSGTV Điều phối xe v2.9.0
-- Nghiệp vụ mới:
-- 1) Hành chính được tạo/điều chỉnh chuyến như Điều phối.
-- 2) Lịch nghỉ tài xế theo ngày, khóa xếp chuyến khi nghỉ.
-- 3) Sự cố: Tài xế -> Hành chính -> BGĐ -> thông báo tài xế -> Hành chính xử lý.
-- 4) Chi phí: Tài xế -> Hành chính -> Kế toán -> BGĐ -> Kế toán -> Chi trả.
-- 5) Kết thúc chuyến bắt buộc ảnh tổng thể xe + KM cuối + mức nhiên liệu.

-- ============================================================
-- CỘT / BẢNG MỚI
-- ============================================================

alter table public.trips
  add column if not exists end_vehicle_image_url text,
  add column if not exists end_fuel_level_percent integer;

alter table public.trips drop constraint if exists trips_end_fuel_level_check;
alter table public.trips add constraint trips_end_fuel_level_check
  check (end_fuel_level_percent is null or end_fuel_level_percent between 0 and 100);

alter table public.expenses
  add column if not exists fleet_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists fleet_reviewed_at timestamptz,
  add column if not exists precheck_accountant_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists precheck_accountant_reviewed_at timestamptz;

-- Nới constraint trước khi chuyển dữ liệu cũ.
alter table public.expenses drop constraint if exists expenses_status_check;
update public.expenses set status = 'pending_fleet' where status = 'pending_director';
update public.expenses set status = 'pending_accountant_final' where status = 'pending_accountant';
alter table public.expenses add constraint expenses_status_check
  check (status in ('pending_fleet','pending_accountant','pending_director','pending_accountant_final','approved','rejected','paid'));
alter table public.expenses alter column status set default 'pending_fleet';

alter table public.incidents drop constraint if exists incidents_status_check;
alter table public.incidents add constraint incidents_status_check
  check (status in ('pending_fleet','pending_director','reported','handling','resolved','rejected'));
alter table public.incidents alter column status set default 'pending_fleet';

create table if not exists public.driver_leaves (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  leave_date date not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, leave_date)
);

create index if not exists driver_leaves_date_idx on public.driver_leaves(leave_date);
create index if not exists driver_leaves_driver_date_idx on public.driver_leaves(driver_id, leave_date);

-- ============================================================
-- QUYỀN
-- ============================================================

create or replace function public.can_dispatch()
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
  select coalesce(public.current_role() in ('fleet','director','accountant','admin'), false);
$$;

-- ============================================================
-- LỊCH NGHỈ TÀI XẾ
-- ============================================================

create or replace function public.validate_driver_leave()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.driver_id and p.role = 'driver' and p.active = true and p.deleted_at is null
  ) then
    raise exception 'Tài khoản được chọn không phải tài xế đang hoạt động';
  end if;

  if exists (
    select 1 from public.trips t
    where t.driver_id = new.driver_id
      and t.status not in ('completed','cancelled')
      and (timezone('Asia/Ho_Chi_Minh', t.scheduled_start))::date = new.leave_date
  ) then
    raise exception 'Tài xế đã có chuyến trong ngày này. Hãy đổi/hủy chuyến trước khi đánh dấu nghỉ';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_driver_leave_trigger on public.driver_leaves;
create trigger validate_driver_leave_trigger
before insert or update on public.driver_leaves
for each row execute function public.validate_driver_leave();

create or replace function public.prevent_trip_on_driver_leave()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  local_trip_date date;
begin
  local_trip_date := (timezone('Asia/Ho_Chi_Minh', new.scheduled_start))::date;
  if exists (
    select 1 from public.driver_leaves dl
    where dl.driver_id = new.driver_id and dl.leave_date = local_trip_date
  ) then
    raise exception 'Tài xế được chọn đang nghỉ ngày %. Vui lòng chọn tài xế khác', to_char(local_trip_date, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_trip_on_driver_leave_trigger on public.trips;
create trigger prevent_trip_on_driver_leave_trigger
before insert or update of driver_id, scheduled_start on public.trips
for each row execute function public.prevent_trip_on_driver_leave();

alter table public.driver_leaves enable row level security;

drop policy if exists "driver leaves own or dispatcher read" on public.driver_leaves;
create policy "driver leaves own or dispatcher read" on public.driver_leaves
for select to authenticated using (
  driver_id = auth.uid() or public.current_role() in ('dispatcher','fleet','admin')
);

drop policy if exists "driver leaves management insert" on public.driver_leaves;
create policy "driver leaves management insert" on public.driver_leaves
for insert to authenticated with check (
  public.current_role() in ('dispatcher','fleet','admin') and created_by = auth.uid()
);

drop policy if exists "driver leaves management update" on public.driver_leaves;
create policy "driver leaves management update" on public.driver_leaves
for update to authenticated using (public.current_role() in ('dispatcher','fleet','admin'))
with check (public.current_role() in ('dispatcher','fleet','admin'));

drop policy if exists "driver leaves management delete" on public.driver_leaves;
create policy "driver leaves management delete" on public.driver_leaves
for delete to authenticated using (public.current_role() in ('dispatcher','fleet','admin'));

-- ============================================================
-- QUY TRÌNH CHI PHÍ MỚI
-- ============================================================

create or replace function public.protect_expense_workflow()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  role_name text := public.current_role();
begin
  if old.status = new.status then return new; end if;

  if old.status = 'pending_fleet' and new.status = 'pending_accountant' and role_name in ('fleet','admin') then
    new.fleet_reviewer_id := auth.uid();
    new.fleet_reviewed_at := coalesce(new.fleet_reviewed_at, now());
    new.reviewer_id := auth.uid(); new.reviewed_at := now(); new.rejection_reason := null;
    return new;
  end if;

  if old.status = 'pending_accountant' and new.status = 'pending_director' and role_name in ('accountant','admin') then
    new.precheck_accountant_reviewer_id := auth.uid();
    new.precheck_accountant_reviewed_at := coalesce(new.precheck_accountant_reviewed_at, now());
    new.reviewer_id := auth.uid(); new.reviewed_at := now(); new.rejection_reason := null;
    return new;
  end if;

  if old.status = 'pending_director' and new.status = 'pending_accountant_final' and role_name in ('director','admin') then
    new.director_reviewer_id := auth.uid();
    new.director_reviewed_at := coalesce(new.director_reviewed_at, now());
    new.reviewer_id := auth.uid(); new.reviewed_at := now(); new.rejection_reason := null;
    return new;
  end if;

  if old.status = 'pending_accountant_final' and new.status = 'approved' and role_name in ('accountant','admin') then
    new.accountant_reviewer_id := auth.uid();
    new.accountant_reviewed_at := coalesce(new.accountant_reviewed_at, now());
    new.reviewer_id := auth.uid(); new.reviewed_at := now(); new.rejection_reason := null;
    return new;
  end if;

  if old.status = 'approved' and new.status = 'paid' and role_name in ('accountant','admin') then
    new.paid_by := auth.uid(); new.paid_at := coalesce(new.paid_at, now());
    new.reviewer_id := auth.uid(); new.reviewed_at := now();
    return new;
  end if;

  if new.status = 'rejected' and (
    (old.status = 'pending_fleet' and role_name in ('fleet','admin')) or
    (old.status in ('pending_accountant','pending_accountant_final') and role_name in ('accountant','admin')) or
    (old.status = 'pending_director' and role_name in ('director','admin'))
  ) then
    if coalesce(trim(new.rejection_reason), '') = '' then raise exception 'Cần nhập lý do từ chối chi phí'; end if;
    new.reviewer_id := auth.uid(); new.reviewed_at := now();
    return new;
  end if;

  raise exception 'Chuyển trạng thái chi phí không hợp lệ hoặc không đúng thẩm quyền';
end;
$$;

drop trigger if exists protect_expense_workflow on public.expenses;
create trigger protect_expense_workflow before update on public.expenses
for each row execute function public.protect_expense_workflow();

drop policy if exists "expenses driver insert" on public.expenses;
create policy "expenses driver insert" on public.expenses for insert to authenticated with check (
  driver_id = auth.uid()
  and status = 'pending_fleet'
  and (
    (expenses.trip_id is not null and exists (
      select 1 from public.trips t where t.id = expenses.trip_id and t.driver_id = auth.uid() and t.vehicle_id = expenses.vehicle_id
    ))
    or (expenses.trip_id is null and exists (
      select 1 from public.vehicles v where v.id = expenses.vehicle_id and v.regular_driver_id = auth.uid()
    ))
  )
);

drop policy if exists "expenses approval update" on public.expenses;
create policy "expenses approval update" on public.expenses for update to authenticated
using (public.can_review_expense()) with check (public.can_review_expense());

-- ============================================================
-- QUY TRÌNH SỰ CỐ MỚI
-- ============================================================

create or replace function public.protect_incident_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare role_name text := public.current_role();
begin
  if old.status = new.status then return new; end if;

  if role_name in ('fleet','admin') and old.status = 'pending_fleet' and new.status = 'pending_director' then
    new.handler_id := auth.uid();
    return new;
  end if;

  if role_name in ('director','admin') and old.status = 'pending_director' and new.status in ('reported','rejected') then
    if new.status = 'rejected' and coalesce(trim(new.rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt sửa/xử lý sự cố'; end if;
    new.director_reviewer_id := auth.uid();
    new.director_reviewed_at := now();
    return new;
  end if;

  if role_name in ('fleet','admin') and old.status = 'reported' and new.status = 'handling' then
    new.handler_id := auth.uid();
    return new;
  end if;

  if role_name in ('fleet','admin') and old.status = 'handling' and new.status = 'resolved' then
    if coalesce(trim(new.resolution), '') = '' then raise exception 'Cần nhập nội dung xử lý sự cố'; end if;
    new.resolved_at := coalesce(new.resolved_at, now());
    return new;
  end if;

  raise exception 'Chuyển trạng thái sự cố không hợp lệ hoặc không đúng thẩm quyền';
end;
$$;

drop trigger if exists protect_incident_workflow_trigger on public.incidents;
create trigger protect_incident_workflow_trigger before update on public.incidents
for each row execute function public.protect_incident_workflow();

drop policy if exists "incidents driver insert" on public.incidents;
create policy "incidents driver insert" on public.incidents for insert to authenticated with check (
  driver_id = auth.uid()
  and status = 'pending_fleet'
  and (
    (incidents.trip_id is not null and exists (
      select 1 from public.trips t where t.id = incidents.trip_id and t.driver_id = auth.uid() and t.vehicle_id = incidents.vehicle_id
    ))
    or (incidents.trip_id is null and exists (
      select 1 from public.vehicles v where v.id = incidents.vehicle_id and v.regular_driver_id = auth.uid()
    ))
  )
);

-- ============================================================
-- HÀNH CHÍNH ĐƯỢC TẠO CHUYẾN + BÀN GIAO CUỐI CHUYẾN
-- ============================================================

create or replace function public.protect_trip_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  role_name text := public.current_role();
  core_changed boolean;
begin
  core_changed :=
    new.vehicle_id is distinct from old.vehicle_id
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
    or new.created_by is distinct from old.created_by
    or new.approval_mode is distinct from old.approval_mode
    or new.approved_plan is distinct from old.approved_plan
    or new.plan_document_url is distinct from old.plan_document_url
    or new.vehicle_request_id is distinct from old.vehicle_request_id;

  if role_name = 'driver' then
    if old.driver_id <> auth.uid() then raise exception 'Không có quyền cập nhật chuyến này'; end if;
    if old.status in ('pending_fleet','pending_director') then raise exception 'Chuyến chưa được phê duyệt để giao cho tài xế'; end if;
    if core_changed then raise exception 'Tài xế không được sửa thông tin điều xe'; end if;

    if new.status = 'ready' and exists (
      select 1 from public.checklists
      where trip_id = new.id and driver_id = auth.uid()
        and not (fuel_ok and tires_ok and lights_horn_ok and vehicle_clean and documents_ok)
    ) then raise exception 'Checklist có mục Không, cần Điều phối/Hành chính duyệt ngoại lệ'; end if;

    if new.status is distinct from old.status and not (
      (old.status = 'assigned' and new.status = 'accepted') or
      (old.status = 'accepted' and new.status = 'ready') or
      (old.status = 'ready' and new.status = 'active') or
      (old.status = 'active' and new.status = 'completed')
    ) then raise exception 'Chuyển trạng thái chuyến không hợp lệ'; end if;

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
    if (new.end_vehicle_image_url is distinct from old.end_vehicle_image_url or new.end_fuel_level_percent is distinct from old.end_fuel_level_percent) and old.status <> 'active' then
      raise exception 'Chỉ được ghi dữ liệu bàn giao xe khi chuyến đang chạy';
    end if;
    if new.status = 'active' and (new.checklist_completed = false or new.start_odometer is null or new.start_odometer_image_url is null or new.started_at is null) then
      raise exception 'Cần checklist, ảnh kilomet đầu và thời gian xuất phát trước khi bắt đầu';
    end if;
    if new.status = 'completed' and (
      new.end_odometer is null or new.end_odometer_image_url is null or new.ended_at is null
      or new.end_vehicle_image_url is null or new.end_fuel_level_percent is null
    ) then
      raise exception 'Cần ảnh KM cuối, ảnh tổng thể xe, mức nhiên liệu và thời gian kết thúc trước khi hoàn thành chuyến';
    end if;
    return new;
  end if;

  if role_name = 'fleet' then
    -- Hành chính có quyền tạo/sửa xếp chuyến tương đương Điều phối khi chuyến còn chờ Hành chính.
    if core_changed and old.status <> 'pending_fleet' then
      raise exception 'Sau khi chuyến đã qua bước Hành chính, không được sửa nội dung xếp chuyến';
    end if;

    if old.status = 'pending_fleet' and new.status is distinct from old.status then
      if new.status = 'assigned' then
        if old.approval_mode <> 'fleet_only' or not old.approved_plan or old.plan_document_url is null then
          raise exception 'Chỉ được bỏ qua BGĐ khi chuyến có kèm văn bản/kế hoạch';
        end if;
      elsif new.status not in ('pending_director','cancelled') then
        raise exception 'Chuyển trạng thái Hành chính duyệt không hợp lệ';
      end if;
      if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt'; end if;
      new.fleet_reviewer_id := auth.uid(); new.fleet_reviewed_at := now();
      return new;
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'assigned' and new.status = 'cancelled') or
      (old.status = 'accepted' and new.status in ('ready','cancelled')) or
      (old.status = 'ready' and new.status = 'cancelled')
    ) then raise exception 'Hành chính không được chuyển trạng thái chuyến theo cách này'; end if;
    return new;
  end if;

  if role_name = 'director' then
    if core_changed then raise exception 'Ban Giám đốc chỉ được phê duyệt, không sửa nội dung điều xe'; end if;
    if old.status <> 'pending_director' or new.status not in ('assigned','cancelled') then raise exception 'Chuyến không ở bước chờ Ban Giám đốc duyệt'; end if;
    if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt'; end if;
    new.director_reviewer_id := auth.uid(); new.director_reviewed_at := now();
    return new;
  end if;

  if role_name = 'dispatcher' then
    if core_changed and old.status <> 'pending_fleet' then raise exception 'Sau khi Hành chính đã duyệt, thay đổi thông tin chuyến phải tạo yêu cầu mới'; end if;
    if new.status is distinct from old.status and not (
      (old.status = 'pending_fleet' and new.status = 'cancelled') or
      (old.status = 'assigned' and new.status = 'cancelled') or
      (old.status = 'accepted' and new.status in ('ready','cancelled')) or
      (old.status = 'ready' and new.status = 'cancelled')
    ) then raise exception 'Điều phối không được tự phê duyệt chuyến'; end if;
    return new;
  end if;

  if role_name = 'admin' then
    if old.status = 'pending_fleet' and new.status in ('pending_director','assigned','cancelled') then
      if new.status = 'assigned' and (old.approval_mode <> 'fleet_only' or not old.approved_plan or old.plan_document_url is null) then raise exception 'Không đủ điều kiện bỏ qua BGĐ'; end if;
      if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt'; end if;
      new.fleet_reviewer_id := auth.uid(); new.fleet_reviewed_at := now(); return new;
    end if;
    if old.status = 'pending_director' and new.status in ('assigned','cancelled') then
      if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt'; end if;
      new.director_reviewer_id := auth.uid(); new.director_reviewed_at := now(); return new;
    end if;
    return new;
  end if;

  raise exception 'Không có quyền cập nhật chuyến';
end;
$$;

drop trigger if exists protect_trip_update_trigger on public.trips;
create trigger protect_trip_update_trigger before update on public.trips
for each row execute function public.protect_trip_update();

-- Chính sách insert chuyến dùng can_dispatch() mới nên Hành chính được tạo chuyến.
drop policy if exists "trips dispatcher insert" on public.trips;
create policy "trips dispatcher insert" on public.trips for insert to authenticated with check (
  public.can_dispatch()
  and created_by = auth.uid()
  and (status = 'pending_fleet' or (status = 'assigned' and vehicle_request_id is not null))
);

-- ============================================================
-- REALTIME (an toàn khi publication đã có bảng)
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_leaves'
     ) then
    alter publication supabase_realtime add table public.driver_leaves;
  end if;
end $$;

-- Hành chính cũng được hoàn tất việc chuyển đề nghị đã duyệt thành chuyến.
create or replace function public.protect_vehicle_request_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  role_name text := public.current_role();
begin
  if role_name in ('fleet','admin') and old.status = 'pending_fleet' and new.status in ('fleet_approved','rejected') then
    new.fleet_reviewer_id := auth.uid();
    new.fleet_reviewed_at := now();
    if new.status = 'rejected' and coalesce(trim(new.rejection_reason), '') = '' then
      raise exception 'Cần nhập lý do từ chối đề nghị điều xe';
    end if;
    return new;
  end if;

  if role_name in ('dispatcher','fleet','admin') and old.status = 'fleet_approved' and new.status = 'converted' then
    if new.created_trip_id is null then raise exception 'Thiếu chuyến được tạo từ đề nghị'; end if;
    return new;
  end if;

  if old.status = new.status and role_name = 'admin' then return new; end if;
  raise exception 'Không đúng thẩm quyền hoặc trạng thái xử lý đề nghị điều xe';
end;
$$;

drop trigger if exists protect_vehicle_request_update_trigger on public.vehicle_requests;
create trigger protect_vehicle_request_update_trigger before update on public.vehicle_requests
for each row execute function public.protect_vehicle_request_update();
