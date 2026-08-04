-- MSG Car v1.5.0 - Quản lý, sửa và xóa chuyến đi an toàn
-- Chạy một lần trong Supabase SQL Editor.

-- Tài xế chỉ xem chuyến của mình; các vai trò quản lý xem toàn bộ.
-- Điều phối và Admin được cập nhật qua policy hiện có.

-- Chỉ cho Điều phối/Admin xóa chuyến chưa chạy, chưa hoàn thành
-- và chưa có chi phí/sự cố gắn vào để tránh mất dữ liệu đối soát.
drop policy if exists "trips dispatcher safe delete" on public.trips;
create policy "trips dispatcher safe delete"
on public.trips
for delete
to authenticated
using (
  public.can_dispatch()
  and status not in ('active', 'completed')
  and start_odometer is null
  and end_odometer is null
  and start_odometer_image_url is null
  and end_odometer_image_url is null
  and not exists (
    select 1 from public.expenses e where e.trip_id = trips.id
  )
  and not exists (
    select 1 from public.incidents i where i.trip_id = trips.id
  )
);
