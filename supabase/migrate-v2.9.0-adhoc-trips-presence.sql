-- BVMSGTV Điều phối xe v2.9.0
-- 1) Quy trình điều xe mới: Điều phối tạo chuyến -> Hành chính điều phối duyệt -> Tài xế.
--    Ban Giám đốc KHÔNG còn duyệt chuyến; BGĐ chỉ xem báo cáo cuối tháng và duyệt chi phí.
-- 2) Tài xế được tạo CHUYẾN ĐỘT XUẤT, chạy ngay theo quy trình checklist/KM/GPS,
--    sau đó Hành chính/Điều phối xác nhận báo cáo.
-- 3) Trạng thái trực tuyến (online) và thời điểm hoạt động gần nhất của tài khoản.
--
-- Chạy file này trong Supabase SQL Editor SAU các migration v2.7.x, TRƯỚC khi deploy frontend v2.9.0.
-- File có thể chạy lại nhiều lần (idempotent).

begin;

-- =====================================================================
-- A. Cột dữ liệu cho chuyến đột xuất
-- =====================================================================
alter table public.trips
  add column if not exists is_adhoc boolean not null default false,
  add column if not exists adhoc_reason text,
  add column if not exists adhoc_report_status text,
  add column if not exists adhoc_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists adhoc_reviewed_at timestamptz,
  add column if not exists adhoc_review_note text;

alter table public.trips drop constraint if exists trips_adhoc_report_status_check;
alter table public.trips add constraint trips_adhoc_report_status_check
  check (
    (is_adhoc = false and adhoc_report_status is null)
    or (is_adhoc = true and adhoc_report_status in ('pending_review','acknowledged','flagged'))
  );

alter table public.trips drop constraint if exists trips_approval_mode_check;
alter table public.trips add constraint trips_approval_mode_check
  check (approval_mode in ('director_required','fleet_only','driver_adhoc'));

-- Chuyến mới mặc định chỉ cần Hành chính duyệt.
alter table public.trips alter column approval_mode set default 'fleet_only';

create index if not exists trips_adhoc_review_idx
  on public.trips(adhoc_report_status, scheduled_start desc)
  where is_adhoc = true;

-- =====================================================================
-- B. Chuyển dữ liệu đang chờ sang quy trình mới
-- =====================================================================
-- Trigger nghiệp vụ không nhận vai trò ứng dụng khi chạy trong SQL Editor,
-- nên tạm tắt USER TRIGGER chỉ trong transaction này.
alter table public.trips disable trigger user;

-- Chuyến đã được Hành chính duyệt và đang chờ BGĐ: giao thẳng cho tài xế.
update public.trips
set status = 'assigned',
    approval_mode = 'fleet_only',
    updated_at = now()
where status = 'pending_director';

-- Chuyến đang chờ Hành chính: chỉ cần Hành chính duyệt là xe đi.
update public.trips
set approval_mode = 'fleet_only',
    updated_at = now()
where status = 'pending_fleet'
  and approval_mode is distinct from 'fleet_only';

alter table public.trips enable trigger user;

-- =====================================================================
-- C. Kiểm soát khi TÀI XẾ tạo chuyến đột xuất
-- =====================================================================
create or replace function public.validate_adhoc_trip_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  role_name text := public.current_role();
  vehicle_state text;
begin
  if coalesce(new.is_adhoc, false) = false then
    if role_name = 'driver' then
      raise exception 'Tài xế chỉ được tạo chuyến đột xuất';
    end if;
    new.adhoc_reason := null;
    new.adhoc_report_status := null;
    new.adhoc_reviewer_id := null;
    new.adhoc_reviewed_at := null;
    new.adhoc_review_note := null;
    return new;
  end if;

  if role_name is distinct from 'driver' then
    raise exception 'Chỉ tài khoản Tài xế được tạo chuyến đột xuất';
  end if;
  if new.driver_id is distinct from auth.uid() or new.created_by is distinct from auth.uid() then
    raise exception 'Chuyến đột xuất phải do chính tài xế tạo và thực hiện';
  end if;
  if coalesce(trim(new.adhoc_reason), '') = '' then
    raise exception 'Cần nhập lý do phát sinh chuyến đột xuất';
  end if;
  if new.scheduled_start < now() - interval '2 hours' or new.scheduled_start > now() + interval '12 hours' then
    raise exception 'Giờ xuất phát chuyến đột xuất phải trong khoảng 2 giờ trước đến 12 giờ tới';
  end if;

  select status into vehicle_state from public.vehicles where id = new.vehicle_id;
  if not found then raise exception 'Không tìm thấy xe'; end if;
  if vehicle_state in ('maintenance','out_of_service') then
    raise exception 'Xe đang sửa chữa hoặc ngừng sử dụng, không thể tạo chuyến đột xuất';
  end if;

  if exists (
    select 1 from public.trips t
    where t.driver_id = auth.uid() and t.status in ('ready','active')
  ) then
    raise exception 'Bạn đang có chuyến sẵn sàng hoặc đang chạy. Hãy hoàn tất chuyến đó trước khi tạo chuyến đột xuất';
  end if;

  -- Chuyến đột xuất đi thẳng tới bước tài xế đã nhận, bỏ qua duyệt trước.
  new.status := 'accepted';
  new.approval_mode := 'driver_adhoc';
  new.approved_plan := false;
  new.vehicle_request_id := null;
  new.fleet_reviewer_id := null;
  new.fleet_reviewed_at := null;
  new.director_reviewer_id := null;
  new.director_reviewed_at := null;
  new.approval_rejection_reason := null;
  new.checklist_completed := false;
  new.start_odometer := null;
  new.end_odometer := null;
  new.start_odometer_image_url := null;
  new.end_odometer_image_url := null;
  new.started_at := null;
  new.ended_at := null;
  new.adhoc_reason := trim(new.adhoc_reason);
  new.adhoc_report_status := 'pending_review';
  new.adhoc_reviewer_id := null;
  new.adhoc_reviewed_at := null;
  new.adhoc_review_note := null;
  return new;
end;
$$;

drop trigger if exists validate_adhoc_trip_insert_trigger on public.trips;
create trigger validate_adhoc_trip_insert_trigger before insert on public.trips
for each row execute function public.validate_adhoc_trip_insert();

-- =====================================================================
-- D. Bảo vệ luồng cập nhật chuyến (thay thế bản v2.7.1)
-- =====================================================================
create or replace function public.protect_trip_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  role_name text := public.current_role();
  core_changed boolean;
  review_changed boolean;
  approval_fields_changed boolean;
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
    or new.vehicle_request_id is distinct from old.vehicle_request_id
    or new.is_adhoc is distinct from old.is_adhoc
    or new.adhoc_reason is distinct from old.adhoc_reason;

  review_changed :=
    new.adhoc_report_status is distinct from old.adhoc_report_status
    or new.adhoc_reviewer_id is distinct from old.adhoc_reviewer_id
    or new.adhoc_reviewed_at is distinct from old.adhoc_reviewed_at
    or new.adhoc_review_note is distinct from old.adhoc_review_note;

  approval_fields_changed :=
    new.fleet_reviewer_id is distinct from old.fleet_reviewer_id
    or new.fleet_reviewed_at is distinct from old.fleet_reviewed_at
    or new.director_reviewer_id is distinct from old.director_reviewer_id
    or new.director_reviewed_at is distinct from old.director_reviewed_at;

  -- Xác nhận báo cáo chuyến đột xuất: Hành chính / Điều phối / Quản trị.
  if review_changed then
    if role_name not in ('fleet','dispatcher','admin') then
      raise exception 'Chỉ Hành chính hoặc Điều phối được xác nhận báo cáo chuyến đột xuất';
    end if;
    if not old.is_adhoc then raise exception 'Chuyến này không phải chuyến đột xuất'; end if;
    if core_changed or new.status is distinct from old.status then
      raise exception 'Xác nhận báo cáo không được thay đổi thông tin hoặc trạng thái chuyến';
    end if;
    if old.adhoc_report_status <> 'pending_review' then
      raise exception 'Báo cáo chuyến đột xuất đã được xác nhận trước đó';
    end if;
    if new.adhoc_report_status not in ('acknowledged','flagged') then
      raise exception 'Trạng thái xác nhận báo cáo không hợp lệ';
    end if;
    if new.adhoc_report_status = 'flagged' and coalesce(trim(new.adhoc_review_note), '') = '' then
      raise exception 'Cần ghi rõ nội dung cần tài xế giải trình';
    end if;
    new.adhoc_reviewer_id := auth.uid();
    new.adhoc_reviewed_at := now();
    return new;
  end if;

  if role_name = 'driver' then
    if old.driver_id <> auth.uid() then raise exception 'Không có quyền cập nhật chuyến này'; end if;
    if old.status in ('pending_fleet','pending_director') then raise exception 'Chuyến chưa được phê duyệt để giao cho tài xế'; end if;
    if core_changed or approval_fields_changed then raise exception 'Tài xế không được sửa thông tin điều xe'; end if;

    -- Tài xế được tự hủy chuyến đột xuất do mình tạo khi chưa xuất phát.
    if old.is_adhoc and new.status = 'cancelled' and old.status in ('accepted','ready') then
      if old.start_odometer is not null or old.started_at is not null then
        raise exception 'Chuyến đã ghi nhận kilomet/xuất phát, không thể tự hủy';
      end if;
      return new;
    end if;

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
    -- pending_director chỉ còn ở dữ liệu cũ; Hành chính xử lý thay BGĐ.
    if old.status not in ('pending_fleet','pending_director') then raise exception 'Chuyến không ở bước chờ Hành chính duyệt'; end if;
    if new.status not in ('assigned','cancelled') then
      raise exception 'Hành chính chỉ được duyệt (giao tài xế) hoặc không duyệt chuyến';
    end if;
    if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt'; end if;
    new.approval_mode := 'fleet_only';
    new.fleet_reviewer_id := auth.uid(); new.fleet_reviewed_at := now();
    return new;
  end if;

  if role_name = 'director' then
    raise exception 'Ban Giám đốc không còn phê duyệt chuyến xe. BGĐ xem báo cáo tổng hợp cuối tháng và duyệt chi phí';
  end if;

  if role_name = 'dispatcher' then
    if approval_fields_changed then raise exception 'Điều phối không được tự ghi nhận bước phê duyệt'; end if;
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
    -- Quản trị hỗ trợ vận hành, vẫn ghi nhận người duyệt theo bước Hành chính.
    if old.status in ('pending_fleet','pending_director') and new.status in ('assigned','cancelled') then
      if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then raise exception 'Cần nhập lý do không duyệt'; end if;
      new.approval_mode := 'fleet_only';
      new.fleet_reviewer_id := auth.uid(); new.fleet_reviewed_at := now(); return new;
    end if;
    return new;
  end if;

  raise exception 'Không có quyền cập nhật chuyến';
end;
$$;

drop trigger if exists protect_trip_update_trigger on public.trips;
create trigger protect_trip_update_trigger before update on public.trips for each row execute function public.protect_trip_update();

-- =====================================================================
-- E. Phân quyền (RLS) chuyến xe
-- =====================================================================
-- Tài xế tạo chuyến đột xuất của chính mình.
drop policy if exists "trips driver adhoc insert" on public.trips;
create policy "trips driver adhoc insert" on public.trips for insert to authenticated with check (
  public.current_role() = 'driver'
  and is_adhoc = true
  and driver_id = auth.uid()
  and created_by = auth.uid()
  and status = 'accepted'
  and vehicle_request_id is null
);

-- Điều phối: chuyến mới luôn chờ Hành chính, trừ chuyến tạo từ đề nghị đã được Hành chính duyệt.
drop policy if exists "trips dispatcher insert" on public.trips;
create policy "trips dispatcher insert" on public.trips for insert to authenticated with check (
  public.can_dispatch()
  and created_by = auth.uid()
  and coalesce(is_adhoc, false) = false
  and (
    status = 'pending_fleet'
    or (status = 'assigned' and vehicle_request_id is not null)
  )
);

-- BGĐ không còn quyền cập nhật chuyến (chỉ xem).
drop policy if exists "trips driver or dispatcher update" on public.trips;
drop policy if exists "trips workflow update" on public.trips;
create policy "trips workflow update" on public.trips for update to authenticated using (
  driver_id = auth.uid() or public.current_role() in ('dispatcher','fleet','admin')
) with check (
  driver_id = auth.uid() or public.current_role() in ('dispatcher','fleet','admin')
);

-- =====================================================================
-- F. Trạng thái trực tuyến của tài khoản
-- =====================================================================
create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  last_platform text,
  updated_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx on public.user_presence(last_seen_at desc);

alter table public.user_presence enable row level security;

drop policy if exists "presence own or management read" on public.user_presence;
create policy "presence own or management read" on public.user_presence
for select to authenticated using (user_id = auth.uid() or public.is_management());

-- Không mở insert/update/delete trực tiếp; chỉ ghi qua RPC touch_presence().
revoke insert, update, delete on public.user_presence from anon, authenticated;

create or replace function public.touch_presence(p_platform text default null)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  stamp timestamptz := now();
begin
  if auth.uid() is null or public.current_role() is null then
    return null;
  end if;
  insert into public.user_presence (user_id, last_seen_at, last_platform, updated_at)
  values (auth.uid(), stamp, left(nullif(trim(coalesce(p_platform, '')), ''), 40), stamp)
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at,
        last_platform = coalesce(excluded.last_platform, public.user_presence.last_platform),
        updated_at = excluded.updated_at;
  return stamp;
end;
$$;

revoke all on function public.touch_presence(text) from public;
revoke all on function public.touch_presence(text) from anon;
grant execute on function public.touch_presence(text) to authenticated;

-- Không thêm user_presence vào supabase_realtime: trạng thái tức thời dùng Realtime Presence,
-- bảng này chỉ lưu "hoạt động gần nhất" để tránh làm tải lại toàn bộ dữ liệu mỗi phút.

commit;
