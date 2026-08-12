-- BVMSGTV v2.7.4
-- Đề nghị do Trưởng khoa gửi đã được Hành chính duyệt thì khi Điều phối tạo chuyến
-- sẽ giao trực tiếp cho tài xế, không yêu cầu Hành chính duyệt lần thứ hai.

create or replace function public.validate_trip_request_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare req public.vehicle_requests%rowtype;
begin
  if new.vehicle_request_id is null then return new; end if;
  select * into req from public.vehicle_requests where id = new.vehicle_request_id;
  if not found then raise exception 'Không tìm thấy đề nghị điều xe'; end if;
  if req.status <> 'fleet_approved' then raise exception 'Đề nghị điều xe chưa được Hành chính duyệt hoặc đã được sử dụng'; end if;
  if new.purpose <> req.purpose then raise exception 'Mục đích chuyến không khớp đề nghị đã duyệt'; end if;
  if req.fleet_reviewer_id is null or req.fleet_reviewed_at is null then
    raise exception 'Đề nghị chưa có thông tin Hành chính phê duyệt hợp lệ';
  end if;

  new.status := 'assigned';
  new.approval_mode := 'fleet_only';
  new.plan_document_url := coalesce(new.plan_document_url, req.plan_document_url);
  new.approved_plan := (new.plan_document_url is not null);
  new.fleet_reviewer_id := req.fleet_reviewer_id;
  new.fleet_reviewed_at := req.fleet_reviewed_at;
  new.director_reviewer_id := null;
  new.director_reviewed_at := null;
  new.approval_rejection_reason := null;
  return new;
end;
$$;

-- Trigger đã tồn tại từ v2.7.0; tạo lại để đảm bảo dùng function mới.
drop trigger if exists validate_trip_request_insert_trigger on public.trips;
create trigger validate_trip_request_insert_trigger before insert on public.trips
for each row execute function public.validate_trip_request_insert();


-- Cho phép Điều phối insert chuyến ở trạng thái assigned chỉ khi chuyến có liên kết
-- vehicle_request_id. Trigger validate_trip_request_insert phía trên sẽ bắt buộc
-- đề nghị phải ở trạng thái fleet_approved và ghi lại đúng thông tin Hành chính duyệt.
drop policy if exists "trips dispatcher insert" on public.trips;
create policy "trips dispatcher insert" on public.trips for insert to authenticated with check (
  public.can_dispatch()
  and created_by = auth.uid()
  and (
    status = 'pending_fleet'
    or (status = 'assigned' and vehicle_request_id is not null)
  )
);
