-- Bật vị trí xe gần thời gian thực cho các bộ phận được phân quyền.
-- Chạy một lần trong Supabase SQL Editor.

alter table public.trips
  add column if not exists current_lat double precision,
  add column if not exists current_lng double precision,
  add column if not exists location_updated_at timestamptz;

create index if not exists trips_active_location_idx
  on public.trips(status, location_updated_at desc)
  where status = 'active';

-- Bảo đảm bảng trips phát sự kiện qua Supabase Realtime.
do $$
begin
  alter publication supabase_realtime add table public.trips;
exception
  when duplicate_object then null;
end $$;

-- Các vai trò quản lý đã đọc được chuyến thông qua policy
-- "trips own or management read" trong schema chính.
