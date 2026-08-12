-- BVMSGTV Điều phối xe v2.7.0
-- Bổ sung: Trưởng khoa gửi đề nghị xe, quy trình duyệt chuyến 2 cấp,
-- BGĐ duyệt sự cố/bảo dưỡng, xóa mềm tài khoản và văn bản kế hoạch.
-- Chạy file này trong Supabase SQL Editor trước khi deploy frontend v2.7.0.

begin;

-- 1) Hồ sơ người dùng: thêm vai trò Trưởng khoa / Trưởng đơn vị và xóa mềm.
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('driver','department_head','dispatcher','accountant','fleet','director','admin'));

-- 2) Đề nghị điều hành xe từ Trưởng khoa / đơn vị.
create table if not exists public.vehicle_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  department text,
  purpose text not null check (purpose in ('patient_pickup','patient_return','community_exam','board_business','staff_transport','medicine_supply','marketing_care','administrative','personal_other')),
  pickup text not null,
  destination text not null,
  contact_name text,
  contact_phone text,
  passenger_count integer check (passenger_count is null or passenger_count >= 0),
  scheduled_start timestamptz not null,
  expected_end timestamptz,
  notes text,
  plan_document_url text,
  status text not null default 'pending_fleet' check (status in ('pending_fleet','fleet_approved','rejected','converted')),
  fleet_reviewer_id uuid references public.profiles(id) on delete set null,
  fleet_reviewed_at timestamptz,
  rejection_reason text,
  created_trip_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_request_time_order check (expected_end is null or expected_end > scheduled_start)
);

create index if not exists vehicle_requests_status_date_idx on public.vehicle_requests(status, scheduled_start);
create index if not exists vehicle_requests_requester_idx on public.vehicle_requests(requester_id, created_at desc);

drop trigger if exists vehicle_requests_updated_at on public.vehicle_requests;
create trigger vehicle_requests_updated_at before update on public.vehicle_requests
for each row execute function public.set_updated_at();

-- 3) Luồng phê duyệt chuyến.
alter table public.trips
  add column if not exists approval_mode text not null default 'director_required',
  add column if not exists approved_plan boolean not null default false,
  add column if not exists plan_document_url text,
  add column if not exists vehicle_request_id uuid,
  add column if not exists fleet_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists fleet_reviewed_at timestamptz,
  add column if not exists director_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists director_reviewed_at timestamptz,
  add column if not exists approval_rejection_reason text;

alter table public.trips drop constraint if exists trips_status_check;
alter table public.trips add constraint trips_status_check
  check (status in ('pending_fleet','pending_director','assigned','accepted','ready','active','completed','cancelled'));
alter table public.trips alter column status set default 'pending_fleet';


create unique index if not exists trips_vehicle_request_unique
  on public.trips(vehicle_request_id) where vehicle_request_id is not null;

-- Nếu chuyến được tạo từ một đề nghị đã duyệt, chỉ cho phép dùng đúng một lần.
create or replace function public.validate_trip_request_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare req public.vehicle_requests%rowtype;
begin
  if new.vehicle_request_id is null then return new; end if;
  select * into req from public.vehicle_requests where id = new.vehicle_request_id;
  if not found then raise exception 'Không tìm thấy đề nghị điều xe'; end if;
  if req.status <> 'fleet_approved' then raise exception 'Đề nghị điều xe chưa được Hành chính duyệt hoặc đã được sử dụng'; end if;
  if new.purpose <> req.purpose then raise exception 'Mục đích chuyến không khớp đề nghị đã duyệt'; end if;
  return new;
end;
$$;

drop trigger if exists validate_trip_request_insert_trigger on public.trips;
create trigger validate_trip_request_insert_trigger before insert on public.trips
for each row execute function public.validate_trip_request_insert();

create or replace function public.mark_vehicle_request_converted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.vehicle_request_id is not null then
    update public.vehicle_requests
    set status = 'converted', created_trip_id = new.id, updated_at = now()
    where id = new.vehicle_request_id and status = 'fleet_approved';
    if not found then raise exception 'Không thể đánh dấu đề nghị điều xe đã tạo chuyến'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mark_vehicle_request_converted_trigger on public.trips;
create trigger mark_vehicle_request_converted_trigger after insert on public.trips
for each row execute function public.mark_vehicle_request_converted();

alter table public.trips drop constraint if exists trips_approval_mode_check;
alter table public.trips add constraint trips_approval_mode_check
  check (approval_mode in ('director_required','fleet_only'));

-- Gắn khóa ngoại sau khi bảng vehicle_requests đã tồn tại.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_vehicle_request_fk') then
    alter table public.trips add constraint trips_vehicle_request_fk
      foreign key (vehicle_request_id) references public.vehicle_requests(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicle_requests_created_trip_fk') then
    alter table public.vehicle_requests add constraint vehicle_requests_created_trip_fk
      foreign key (created_trip_id) references public.trips(id) on delete set null;
  end if;
end $$;

-- Giữ tương thích dữ liệu cũ: các chuyến đã tồn tại được coi là đã đi qua quy trình cũ.
update public.trips
set approval_mode = coalesce(approval_mode, 'director_required')
where approval_mode is null;

-- 4) Sự cố phải qua BGĐ duyệt trước khi Hành chính xử lý.
alter table public.incidents
  add column if not exists director_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists director_reviewed_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.incidents drop constraint if exists incidents_status_check;
alter table public.incidents add constraint incidents_status_check
  check (status in ('pending_director','reported','handling','resolved','rejected'));
alter table public.incidents alter column status set default 'pending_director';

-- 5) Bảo dưỡng/sửa chữa phải qua BGĐ duyệt.
alter table public.maintenances
  add column if not exists requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists director_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists director_reviewed_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.maintenances drop constraint if exists maintenances_status_check;
alter table public.maintenances add constraint maintenances_status_check
  check (status in ('pending_director','scheduled','in_progress','completed','cancelled','rejected'));
alter table public.maintenances alter column status set default 'pending_director';

-- 6) Hàm quyền mới.
create or replace function public.is_management()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('dispatcher','accountant','fleet','director','admin'), false);
$$;

create or replace function public.can_fleet_review()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('fleet','admin'), false);
$$;

create or replace function public.can_director_review()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('director','admin'), false);
$$;

-- 7) Bảo vệ quy trình đề nghị xe.
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

  if role_name in ('dispatcher','admin') and old.status = 'fleet_approved' and new.status = 'converted' then
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

-- 8) Bảo vệ luồng duyệt chuyến.
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
    ) then raise exception 'Checklist có mục Không, cần điều phối duyệt ngoại lệ'; end if;

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
    if new.status = 'active' and (new.checklist_completed = false or new.start_odometer is null or new.start_odometer_image_url is null or new.started_at is null) then
      raise exception 'Cần checklist, ảnh kilomet đầu và thời gian xuất phát trước khi bắt đầu';
    end if;
    if new.status = 'completed' and (new.end_odometer is null or new.end_odometer_image_url is null or new.ended_at is null) then
      raise exception 'Cần ảnh kilomet cuối và thời gian kết thúc trước khi hoàn thành chuyến';
    end if;
    return new;
  end if;

  if role_name = 'fleet' then
    if core_changed then raise exception 'Hành chính chỉ được duyệt, không được sửa nội dung yêu cầu điều xe'; end if;
    if old.status <> 'pending_fleet' then raise exception 'Chuyến không ở bước chờ Hành chính duyệt'; end if;
    if new.status = 'assigned' then
      if old.approval_mode <> 'fleet_only' or not old.approved_plan or old.plan_document_url is null or old.purpose not in ('board_business','patient_pickup') then
        raise exception 'Chỉ được bỏ qua BGĐ khi có văn bản kế hoạch đã phê duyệt cho chuyến công tác hoặc đón bệnh nhân';
      end if;
    elsif new.status not in ('pending_director','cancelled') then
      raise exception 'Chuyển trạng thái Hành chính duyệt không hợp lệ';
    end if;
    if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt'; end if;
    new.fleet_reviewer_id := auth.uid(); new.fleet_reviewed_at := now();
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
    -- Quản trị được hỗ trợ vận hành nhưng vẫn ghi nhận người duyệt theo bước.
    if old.status = 'pending_fleet' and new.status in ('pending_director','assigned','cancelled') then
      if new.status = 'assigned' and (old.approval_mode <> 'fleet_only' or not old.approved_plan or old.plan_document_url is null or old.purpose not in ('board_business','patient_pickup')) then
        raise exception 'Không đủ điều kiện bỏ qua BGĐ';
      end if;
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
create trigger protect_trip_update_trigger before update on public.trips for each row execute function public.protect_trip_update();

-- 9) Bảo vệ sự cố.
create or replace function public.protect_incident_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare role_name text := public.current_role();
begin
  if old.status = new.status then return new; end if;
  if role_name in ('director','admin') and old.status = 'pending_director' and new.status in ('reported','rejected') then
    if new.status = 'rejected' and coalesce(trim(new.rejection_reason), '') = '' then raise exception 'Cần nhập lý do từ chối sự cố'; end if;
    new.director_reviewer_id := auth.uid(); new.director_reviewed_at := now(); return new;
  end if;
  if role_name in ('fleet','admin') and old.status = 'reported' and new.status = 'handling' then
    new.handler_id := auth.uid(); return new;
  end if;
  if role_name in ('fleet','admin') and old.status = 'handling' and new.status = 'resolved' then
    if coalesce(trim(new.resolution), '') = '' then raise exception 'Cần nhập nội dung xử lý sự cố'; end if;
    new.resolved_at := coalesce(new.resolved_at, now()); return new;
  end if;
  raise exception 'Chuyển trạng thái sự cố không hợp lệ hoặc không đúng thẩm quyền';
end;
$$;

drop trigger if exists protect_incident_workflow_trigger on public.incidents;
create trigger protect_incident_workflow_trigger before update on public.incidents
for each row execute function public.protect_incident_workflow();

-- 10) Bảo vệ bảo dưỡng/sửa chữa.
create or replace function public.protect_maintenance_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare role_name text := public.current_role();
begin
  if old.status = new.status then return new; end if;
  if role_name in ('director','admin') and old.status = 'pending_director' and new.status in ('scheduled','rejected') then
    if new.status = 'rejected' and coalesce(trim(new.rejection_reason), '') = '' then raise exception 'Cần nhập lý do từ chối bảo dưỡng'; end if;
    new.director_reviewer_id := auth.uid(); new.director_reviewed_at := now(); return new;
  end if;
  if role_name in ('fleet','admin') and old.status = 'scheduled' and new.status in ('in_progress','cancelled') then return new; end if;
  if role_name in ('fleet','admin') and old.status = 'in_progress' and new.status = 'completed' then return new; end if;
  raise exception 'Chuyển trạng thái bảo dưỡng không hợp lệ hoặc không đúng thẩm quyền';
end;
$$;

drop trigger if exists protect_maintenance_workflow_trigger on public.maintenances;
create trigger protect_maintenance_workflow_trigger before update on public.maintenances
for each row execute function public.protect_maintenance_workflow();

-- Cập nhật xe khi bảo dưỡng đã được BGĐ duyệt hoặc bắt đầu/kết thúc.
create or replace function public.sync_maintenance_vehicle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'scheduled' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.vehicles set
      next_maintenance_date = new.scheduled_date,
      next_maintenance_odometer = new.odometer
    where id = new.vehicle_id;
  elsif new.status = 'in_progress' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.vehicles set status = 'maintenance' where id = new.vehicle_id and status <> 'in_use';
  elsif new.status in ('completed','cancelled','rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.vehicles set status = 'available' where id = new.vehicle_id and status = 'maintenance';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_maintenance_vehicle_trigger on public.maintenances;
create trigger sync_maintenance_vehicle_trigger after insert or update on public.maintenances
for each row execute function public.sync_maintenance_vehicle();

-- 11) RLS cho đề nghị xe và các bước phê duyệt.
alter table public.vehicle_requests enable row level security;

drop policy if exists "vehicle requests own or management read" on public.vehicle_requests;
create policy "vehicle requests own or management read" on public.vehicle_requests
for select to authenticated using (
  requester_id = auth.uid()
  or public.current_role() in ('dispatcher','fleet','director','admin')
);

drop policy if exists "vehicle requests department insert" on public.vehicle_requests;
create policy "vehicle requests department insert" on public.vehicle_requests
for insert to authenticated with check (
  requester_id = auth.uid()
  and public.current_role() in ('department_head','admin')
  and status = 'pending_fleet'
);

drop policy if exists "vehicle requests workflow update" on public.vehicle_requests;
create policy "vehicle requests workflow update" on public.vehicle_requests
for update to authenticated using (public.current_role() in ('dispatcher','fleet','admin'))
with check (public.current_role() in ('dispatcher','fleet','admin'));

-- Chuyến: tài xế chỉ thấy sau khi đã được giao; Hành chính/BGĐ được quyền duyệt.
drop policy if exists "trips own or management read" on public.trips;
create policy "trips own or management read" on public.trips for select to authenticated using (
  (driver_id = auth.uid() and status not in ('pending_fleet','pending_director'))
  or public.is_management()
);

drop policy if exists "trips dispatcher insert" on public.trips;
create policy "trips dispatcher insert" on public.trips for insert to authenticated with check (
  public.can_dispatch()
  and created_by = auth.uid()
  and status = 'pending_fleet'
);

drop policy if exists "trips driver or dispatcher update" on public.trips;
drop policy if exists "trips workflow update" on public.trips;
create policy "trips workflow update" on public.trips for update to authenticated using (
  driver_id = auth.uid() or public.current_role() in ('dispatcher','fleet','director','admin')
) with check (
  driver_id = auth.uid() or public.current_role() in ('dispatcher','fleet','director','admin')
);

-- Sự cố: BGĐ duyệt, Hành chính xử lý.
drop policy if exists "incidents fleet update" on public.incidents;
drop policy if exists "incidents workflow update" on public.incidents;
create policy "incidents workflow update" on public.incidents for update to authenticated using (
  public.current_role() in ('fleet','director','admin')
) with check (
  public.current_role() in ('fleet','director','admin')
);

drop policy if exists "incidents driver insert" on public.incidents;
create policy "incidents driver insert" on public.incidents for insert to authenticated with check (
  driver_id = auth.uid()
  and status = 'pending_director'
  and (
    (incidents.trip_id is not null and exists (
      select 1 from public.trips t where t.id = incidents.trip_id and t.driver_id = auth.uid() and t.vehicle_id = incidents.vehicle_id
    ))
    or (incidents.trip_id is null and exists (
      select 1 from public.vehicles v where v.id = incidents.vehicle_id and v.regular_driver_id = auth.uid()
    ))
  )
);

-- Bảo dưỡng: Hành chính đề nghị, BGĐ duyệt, Hành chính thực hiện.
drop policy if exists "maintenances fleet insert" on public.maintenances;
create policy "maintenances fleet insert" on public.maintenances for insert to authenticated with check (
  public.current_role() in ('fleet','admin') and status = 'pending_director'
);

drop policy if exists "maintenances fleet update" on public.maintenances;
drop policy if exists "maintenances workflow update" on public.maintenances;
create policy "maintenances workflow update" on public.maintenances for update to authenticated using (
  public.current_role() in ('fleet','director','admin')
) with check (
  public.current_role() in ('fleet','director','admin')
);

-- 12) Storage: cho phép văn bản kế hoạch PDF/Office tối đa 10 MB và quyền đọc theo hồ sơ.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/heic','image/heif',
  'audio/webm','audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/aac','audio/ogg',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'vehicle-media';

-- Đề nghị xe dùng thư mục do chính Trưởng khoa tải lên; các tài khoản quản lý có quyền đọc qua policy hiện tại.

-- 13) Audit/realtime cho bảng mới.
drop trigger if exists audit_vehicle_requests on public.vehicle_requests;
create trigger audit_vehicle_requests after insert or update or delete on public.vehicle_requests
for each row execute function public.audit_change();

do $$
begin
  alter publication supabase_realtime add table public.vehicle_requests;
exception when duplicate_object then null;
end $$;

commit;
