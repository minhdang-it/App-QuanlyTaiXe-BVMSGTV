-- BVMSGTV v2.11.1
-- Đồng bộ lại workflow chuyến xe theo flow hiện hành:
-- Điều phối -> Hành chính duyệt -> Tài xế.
-- BGĐ không duyệt chuyến; tài xế không cần checklist/GPS điện thoại.
-- Migration idempotent: có thể chạy trên DB đã qua v2.9/v2.10.2.

begin;

create or replace function public.protect_trip_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  -- Chuyến đột xuất: Hành chính / Điều phối / Quản trị xác nhận báo cáo sau.
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

  -- Tài xế: thao tác tối giản. Nhận chuyến -> KM đầu -> bắt đầu -> KM cuối -> kết thúc.
  if role_name = 'driver' then
    if old.driver_id <> auth.uid() then raise exception 'Không có quyền cập nhật chuyến này'; end if;
    if old.status in ('pending_fleet','pending_director') then raise exception 'Chuyến chưa được Hành chính duyệt'; end if;
    if core_changed or approval_fields_changed then raise exception 'Tài xế không được sửa thông tin điều xe'; end if;

    if old.is_adhoc and new.status = 'cancelled' and old.status in ('accepted','ready') then
      if old.start_odometer is not null or old.started_at is not null then
        raise exception 'Chuyến đã ghi nhận kilomet/xuất phát, không thể tự hủy';
      end if;
      return new;
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'assigned' and new.status = 'accepted') or
      (old.status = 'accepted' and new.status in ('ready','active')) or
      (old.status = 'ready' and new.status = 'active') or
      (old.status = 'active' and new.status = 'completed')
    ) then
      raise exception 'Chuyển trạng thái chuyến không hợp lệ';
    end if;

    -- Checklist cũ được giữ cho lịch sử nhưng không còn bắt buộc.
    if (new.start_odometer is distinct from old.start_odometer
        or new.start_odometer_image_url is distinct from old.start_odometer_image_url)
       and old.status not in ('accepted','ready','active') then
      raise exception 'Chỉ được ghi kilomet đầu sau khi đã nhận chuyến';
    end if;

    if (new.end_odometer is distinct from old.end_odometer
        or new.end_odometer_image_url is distinct from old.end_odometer_image_url)
       and old.status <> 'active' then
      raise exception 'Chỉ được ghi kilomet cuối khi chuyến đang chạy';
    end if;

    if new.status = 'active' and (
      new.start_odometer is null
      or new.start_odometer_image_url is null
      or new.started_at is null
    ) then
      raise exception 'Cần ảnh kilomet đầu và thời gian xuất phát trước khi bắt đầu';
    end if;

    if new.status = 'completed' and (
      new.end_odometer is null
      or new.end_odometer_image_url is null
      or new.ended_at is null
    ) then
      raise exception 'Cần ảnh kilomet cuối và thời gian kết thúc trước khi hoàn thành chuyến';
    end if;
    return new;
  end if;

  -- Hành chính duyệt là giao chuyến cho tài xế, không qua BGĐ.
  if role_name = 'fleet' then
    if core_changed then raise exception 'Hành chính chỉ được duyệt, không được sửa nội dung yêu cầu điều xe'; end if;
    if old.status not in ('pending_fleet','pending_director') then
      raise exception 'Chuyến không ở bước chờ Hành chính duyệt';
    end if;
    if new.status not in ('assigned','cancelled') then
      raise exception 'Hành chính chỉ được duyệt (giao tài xế) hoặc không duyệt chuyến';
    end if;
    if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then
      raise exception 'Cần nhập lý do không duyệt';
    end if;
    new.approval_mode := 'fleet_only';
    new.fleet_reviewer_id := auth.uid();
    new.fleet_reviewed_at := now();
    new.director_reviewer_id := null;
    new.director_reviewed_at := null;
    return new;
  end if;

  if role_name = 'director' then
    raise exception 'Ban Giám đốc không phê duyệt chuyến xe; BGĐ duyệt chi phí và xem báo cáo';
  end if;

  if role_name = 'dispatcher' then
    if approval_fields_changed then raise exception 'Điều phối không được tự ghi nhận bước phê duyệt'; end if;
    if core_changed and old.status <> 'pending_fleet' then
      raise exception 'Sau khi Hành chính đã duyệt, thay đổi thông tin chuyến phải tạo yêu cầu mới';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'pending_fleet' and new.status = 'cancelled') or
      (old.status = 'assigned' and new.status = 'cancelled') or
      (old.status = 'accepted' and new.status in ('ready','cancelled')) or
      (old.status = 'ready' and new.status = 'cancelled')
    ) then
      raise exception 'Điều phối không được tự phê duyệt chuyến';
    end if;
    return new;
  end if;

  if role_name = 'admin' then
    -- Quản trị được hỗ trợ thao tác Hành chính khi chuyến đang chờ duyệt.
    if old.status in ('pending_fleet','pending_director') and new.status in ('assigned','cancelled') then
      if new.status = 'cancelled' and coalesce(trim(new.approval_rejection_reason), '') = '' then
        raise exception 'Cần nhập lý do không duyệt';
      end if;
      new.approval_mode := 'fleet_only';
      new.fleet_reviewer_id := auth.uid();
      new.fleet_reviewed_at := now();
      new.director_reviewer_id := null;
      new.director_reviewed_at := null;
      return new;
    end if;
    return new;
  end if;

  raise exception 'Không có quyền cập nhật chuyến';
end;
$$;

drop trigger if exists protect_trip_update_trigger on public.trips;
create trigger protect_trip_update_trigger
before update on public.trips
for each row execute function public.protect_trip_update();

-- Bảo đảm đúng RLS flow hiện hành.
drop policy if exists "trips driver or dispatcher update" on public.trips;
drop policy if exists "trips workflow update" on public.trips;
create policy "trips workflow update" on public.trips
for update to authenticated
using (driver_id = auth.uid() or public.current_role() in ('dispatcher','fleet','admin'))
with check (driver_id = auth.uid() or public.current_role() in ('dispatcher','fleet','admin'));

-- Bảo đảm constraint bắt đầu chuyến không còn yêu cầu checklist/GPS điện thoại.
alter table public.trips drop constraint if exists active_trip_requires_start;
alter table public.trips add constraint active_trip_requires_start check (
  status not in ('active','completed') or
  (start_odometer is not null and start_odometer_image_url is not null and started_at is not null)
);

commit;
