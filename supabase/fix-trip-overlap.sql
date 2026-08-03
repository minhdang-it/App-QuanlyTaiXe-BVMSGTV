-- Điều phối xe BVMSGTV v1.3.1
-- Chạy file này nếu schema.sql cũ dừng tại lỗi:
-- ERROR: functions in index expression must be marked IMMUTABLE

create extension if not exists btree_gist;

alter table public.trips
  add column if not exists scheduled_period tstzrange;

create or replace function public.sync_trip_scheduled_period()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.scheduled_period := tstzrange(
    new.scheduled_start,
    coalesce(new.expected_end, new.scheduled_start + interval '1 hour'),
    '[)'
  );
  return new;
end;
$$;

drop trigger if exists trips_sync_scheduled_period on public.trips;
create trigger trips_sync_scheduled_period
before insert or update on public.trips
for each row execute function public.sync_trip_scheduled_period();

update public.trips
set scheduled_period = tstzrange(
  scheduled_start,
  coalesce(expected_end, scheduled_start + interval '1 hour'),
  '[)'
)
where scheduled_period is null
   or scheduled_period is distinct from tstzrange(
     scheduled_start,
     coalesce(expected_end, scheduled_start + interval '1 hour'),
     '[)'
   );

alter table public.trips
  alter column scheduled_period set not null;

alter table public.trips
  drop constraint if exists trips_vehicle_time_no_overlap;

alter table public.trips
  drop constraint if exists trips_driver_time_no_overlap;

alter table public.trips
  add constraint trips_vehicle_time_no_overlap
  exclude using gist (
    vehicle_id with =,
    scheduled_period with &&
  )
  where (status not in ('completed','cancelled'));

alter table public.trips
  add constraint trips_driver_time_no_overlap
  exclude using gist (
    driver_id with =,
    scheduled_period with &&
  )
  where (status not in ('completed','cancelled'));
