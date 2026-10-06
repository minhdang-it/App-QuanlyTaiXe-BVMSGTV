-- BVMSGTV v2.10.2
-- Navicom là nguồn GPS/camera chính; tài xế không còn checklist/GPS điện thoại bắt buộc.

begin;

alter table public.vehicles
  add column if not exists navicom_enabled boolean not null default false,
  add column if not exists navicom_device_id text,
  add column if not exists navicom_channel_count integer,
  add column if not exists navicom_notes text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'vehicles_navicom_channel_count_nonnegative') then
    alter table public.vehicles
      add constraint vehicles_navicom_channel_count_nonnegative
      check (navicom_channel_count is null or navicom_channel_count >= 0);
  end if;
end $$;

create unique index if not exists vehicles_navicom_device_unique
  on public.vehicles(navicom_device_id)
  where navicom_device_id is not null and btrim(navicom_device_id) <> '';

-- Flow tài xế mới: KM đầu -> Bắt đầu -> KM cuối -> Kết thúc.
-- Checklist cũ vẫn được giữ để xem lịch sử, nhưng không còn là điều kiện bắt đầu chuyến.
alter table public.trips drop constraint if exists active_trip_requires_start;
alter table public.trips add constraint active_trip_requires_start check (
  status not in ('active','completed') or
  (start_odometer is not null and start_odometer_image_url is not null and started_at is not null)
);

commit;
