-- BVMSGTV v2.7.12
-- Nhiều tệp đính kèm cho Đề nghị xe và Điều xe; giữ plan_document_url để tương thích luồng duyệt cũ.

begin;

alter table public.vehicle_requests
  add column if not exists plan_attachments jsonb not null default '[]'::jsonb;

alter table public.trips
  add column if not exists plan_attachments jsonb not null default '[]'::jsonb;

-- Chuyển dữ liệu cũ thành danh sách một tệp để giao diện mới vẫn xem được.
-- HOTFIX: các bảng đang có trigger bảo vệ nghiệp vụ; SQL Editor không mang vai trò
-- ứng dụng nên update backfill sẽ bị trigger từ chối. Tạm tắt USER TRIGGER chỉ trong
-- transaction migration này để không đổi trạng thái/updated_at/audit ngoài ý muốn.
alter table public.vehicle_requests disable trigger user;
alter table public.trips disable trigger user;

update public.vehicle_requests
set plan_attachments = jsonb_build_array(jsonb_build_object(
  'path', plan_document_url,
  'name', 'Văn bản kế hoạch',
  'mime_type', null,
  'size_bytes', null
))
where plan_document_url is not null
  and jsonb_array_length(coalesce(plan_attachments, '[]'::jsonb)) = 0;

update public.trips
set plan_attachments = jsonb_build_array(jsonb_build_object(
  'path', plan_document_url,
  'name', 'Văn bản kế hoạch',
  'mime_type', null,
  'size_bytes', null
))
where plan_document_url is not null
  and jsonb_array_length(coalesce(plan_attachments, '[]'::jsonb)) = 0;

alter table public.vehicle_requests enable trigger user;
alter table public.trips enable trigger user;

-- Khi Điều phối tạo chuyến từ đề nghị đã được Hành chính duyệt,
-- kế thừa toàn bộ tệp đã duyệt. plan_document_url vẫn giữ tệp đầu tiên để
-- các trigger/phân quyền cũ tiếp tục hoạt động an toàn.
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
  if jsonb_array_length(coalesce(new.plan_attachments, '[]'::jsonb)) = 0 then
    new.plan_attachments := coalesce(req.plan_attachments, '[]'::jsonb);
  end if;
  new.plan_document_url := coalesce(
    new.plan_document_url,
    req.plan_document_url,
    new.plan_attachments -> 0 ->> 'path'
  );
  new.approved_plan := (
    new.plan_document_url is not null
    or jsonb_array_length(coalesce(new.plan_attachments, '[]'::jsonb)) > 0
  );
  new.fleet_reviewer_id := req.fleet_reviewer_id;
  new.fleet_reviewed_at := req.fleet_reviewed_at;
  new.director_reviewer_id := null;
  new.director_reviewed_at := null;
  new.approval_rejection_reason := null;
  return new;
end;
$$;

drop trigger if exists validate_trip_request_insert_trigger on public.trips;
create trigger validate_trip_request_insert_trigger before insert on public.trips
for each row execute function public.validate_trip_request_insert();

-- Mở thêm các định dạng văn phòng thông dụng. Giữ giới hạn 10 MB mỗi tệp.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif',
      'audio/webm','audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/aac','audio/ogg',
      'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ]
where id = 'vehicle-media';

commit;
