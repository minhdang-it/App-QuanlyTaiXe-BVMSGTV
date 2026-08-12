-- BVMSGTV Điều phối xe v2.7.1
-- Điều chỉnh quy trình duyệt chuyến:
-- 1) Mặc định: Điều phối -> Hành chính -> BGĐ -> Tài xế.
-- 2) Nếu chuyến có kèm kế hoạch/văn bản: Điều phối -> Hành chính -> Tài xế.
-- Chạy sau migrate-v2.7.0-workflows.sql nếu database đã ở v2.7.0.

begin;

-- Chuẩn hóa các chuyến đang chờ Hành chính: chỉ cần có kế hoạch là đủ điều kiện bỏ qua BGĐ.
update public.trips
set approval_mode = 'fleet_only',
    approved_plan = true,
    updated_at = now()
where status = 'pending_fleet'
  and plan_document_url is not null;

update public.trips
set approval_mode = 'director_required',
    approved_plan = false,
    updated_at = now()
where status = 'pending_fleet'
  and plan_document_url is null;

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
      if new.status = 'assigned' and (old.approval_mode <> 'fleet_only' or not old.approved_plan or old.plan_document_url is null) then
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


commit;
