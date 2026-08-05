-- Bổ sung vị trí hiện tại cho chuyến đang chạy.
-- Chạy một lần trên Supabase SQL Editor khi nâng cấp từ bản cũ.

alter table public.trips
  add column if not exists current_lat double precision,
  add column if not exists current_lng double precision,
  add column if not exists location_updated_at timestamptz;

create index if not exists trips_active_location_idx
  on public.trips(status, location_updated_at desc)
  where status = 'active';
