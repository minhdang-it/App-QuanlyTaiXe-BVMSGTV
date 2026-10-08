-- BVMSGTV v2.11.13 - Nhật ký GPS theo từng chuyến. CHẠY SAU migration trips/vehicles.
-- Không thay đổi trigger bảo vệ trạng thái/chuyến hiện tại; không sửa dữ liệu chuyến cũ.
begin;

create table if not exists public.trip_gps_samples (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  gps_at timestamptz not null,
  received_at timestamptz not null default now(),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  speed_kph numeric(7,2) check (speed_kph is null or speed_kph between 0 and 240),
  source text not null default 'navicom' check (source = 'navicom'),
  constraint trip_gps_sample_unique unique(trip_id, gps_at, latitude, longitude)
);
create index if not exists trip_gps_samples_trip_time on public.trip_gps_samples(trip_id, gps_at desc);
create index if not exists trip_gps_samples_vehicle_time on public.trip_gps_samples(vehicle_id, gps_at desc);

create table if not exists public.trip_gps_summaries (
  trip_id uuid primary key references public.trips(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  started_at timestamptz,
  ended_at timestamptz,
  start_lat double precision,
  start_lng double precision,
  start_gps_at timestamptz,
  end_lat double precision,
  end_lng double precision,
  end_gps_at timestamptz,
  max_speed_kph numeric(7,2),
  max_speed_lat double precision,
  max_speed_lng double precision,
  max_speed_gps_at timestamptz,
  sample_count integer not null default 0,
  outlier_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists trip_gps_summaries_vehicle on public.trip_gps_summaries(vehicle_id, started_at desc);

-- Đồng bộ summary từ mẫu GPS: lấy đầu trong 0..+90s và cuối trong -90..0s,
-- không sử dụng vị trí stale quá 90s. Tốc độ >160 km/h vẫn lưu và gắn cờ cần kiểm tra.
create or replace function public.refresh_trip_gps_summary(p_trip_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  t public.trips%rowtype;
  start_pt public.trip_gps_samples%rowtype;
  end_pt public.trip_gps_samples%rowtype;
  speed_pt public.trip_gps_samples%rowtype;
  ct integer := 0;
  outliers integer := 0;
begin
  select * into t from public.trips where id=p_trip_id;
  if not found or t.started_at is null then return; end if;

  select * into start_pt from public.trip_gps_samples s
  where s.trip_id=p_trip_id and s.gps_at between t.started_at and t.started_at + interval '90 seconds'
  order by (s.gps_at < t.started_at) asc, abs(extract(epoch from s.gps_at - t.started_at)), s.gps_at asc limit 1;

  if t.ended_at is not null then
    select * into end_pt from public.trip_gps_samples s
    where s.trip_id=p_trip_id and s.gps_at between t.ended_at - interval '90 seconds' and t.ended_at
    order by (s.gps_at > t.ended_at) asc, abs(extract(epoch from s.gps_at - t.ended_at)), s.gps_at desc limit 1;
  end if;

  select * into speed_pt from public.trip_gps_samples s
  where s.trip_id=p_trip_id
    and s.gps_at >= t.started_at
    and s.gps_at <= coalesce(t.ended_at, now())
    and s.speed_kph is not null
  order by s.speed_kph desc, s.gps_at asc limit 1;

  select count(*), count(*) filter (where s.speed_kph>160)
  into ct,outliers from public.trip_gps_samples s
  where s.trip_id=p_trip_id and s.gps_at between t.started_at and coalesce(t.ended_at, now());

  insert into public.trip_gps_summaries
    (trip_id,vehicle_id,started_at,ended_at,start_lat,start_lng,start_gps_at,end_lat,end_lng,end_gps_at,
     max_speed_kph,max_speed_lat,max_speed_lng,max_speed_gps_at,sample_count,outlier_count,updated_at)
  values
    (p_trip_id,t.vehicle_id,t.started_at,t.ended_at,start_pt.latitude,start_pt.longitude,start_pt.gps_at,
     end_pt.latitude,end_pt.longitude,end_pt.gps_at,speed_pt.speed_kph,speed_pt.latitude,speed_pt.longitude,
     speed_pt.gps_at,ct,outliers,now())
  on conflict(trip_id) do update set
    vehicle_id=excluded.vehicle_id, started_at=excluded.started_at, ended_at=excluded.ended_at,
    start_lat=excluded.start_lat, start_lng=excluded.start_lng, start_gps_at=excluded.start_gps_at,
    end_lat=excluded.end_lat, end_lng=excluded.end_lng, end_gps_at=excluded.end_gps_at,
    max_speed_kph=excluded.max_speed_kph, max_speed_lat=excluded.max_speed_lat,
    max_speed_lng=excluded.max_speed_lng, max_speed_gps_at=excluded.max_speed_gps_at,
    sample_count=excluded.sample_count, outlier_count=excluded.outlier_count, updated_at=now();
end;
$$;

-- Tạo tóm tắt ngay khi chuyến bắt đầu/kết thúc; collector làm mới mỗi lần ghi mẫu.
create or replace function public.refresh_trip_gps_summary_on_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.started_at is not null and (
    new.started_at is distinct from old.started_at
    or new.ended_at is distinct from old.ended_at
    or new.status is distinct from old.status
  ) then
    perform public.refresh_trip_gps_summary(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trip_gps_summary_on_trip_change on public.trips;
create trigger trip_gps_summary_on_trip_change
  after update of started_at,ended_at,status on public.trips
  for each row execute function public.refresh_trip_gps_summary_on_status();

alter table public.trip_gps_samples enable row level security;
alter table public.trip_gps_summaries enable row level security;
-- Không cho ứng dụng/tài xế tự tạo hoặc sửa tọa độ, tốc độ. Chỉ collector dùng service_role.
revoke all on public.trip_gps_samples from anon, authenticated;
revoke all on public.trip_gps_summaries from anon, authenticated;
grant select on public.trip_gps_samples to authenticated;
grant select on public.trip_gps_summaries to authenticated;
grant all on public.trip_gps_samples, public.trip_gps_summaries to service_role;
grant usage, select on sequence public.trip_gps_samples_id_seq to service_role;

-- Chỉ BGĐ, Hành chính, Điều phối, Quản trị xem vị trí lịch sử.
drop policy if exists "trip gps management read" on public.trip_gps_samples;
create policy "trip gps management read" on public.trip_gps_samples for select to authenticated
using (public.current_role() in ('director','fleet','dispatcher','admin'));
drop policy if exists "trip gps summaries management read" on public.trip_gps_summaries;
create policy "trip gps summaries management read" on public.trip_gps_summaries for select to authenticated
using (public.current_role() in ('director','fleet','dispatcher','admin'));

revoke all on function public.refresh_trip_gps_summary(uuid) from public, anon, authenticated;
grant execute on function public.refresh_trip_gps_summary(uuid) to service_role;
revoke all on function public.refresh_trip_gps_summary_on_status() from public, anon, authenticated;
commit;

-- Kiểm tra sau khi chạy:
-- select table_name from information_schema.tables
-- where table_schema='public' and table_name in ('trip_gps_samples','trip_gps_summaries');
