-- v2.7.6 - Theo dõi xe cho tài xế
-- Thêm hạn phí đường bộ, lịch thay nhớt và RPC giới hạn quyền cập nhật của tài xế.

alter table public.vehicles add column if not exists road_fee_expiry date;
alter table public.vehicles add column if not exists last_oil_change_date date;
alter table public.vehicles add column if not exists last_oil_change_odometer integer;
alter table public.vehicles add column if not exists next_oil_change_date date;
alter table public.vehicles add column if not exists next_oil_change_odometer integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'vehicles_last_oil_odometer_nonnegative') then
    alter table public.vehicles add constraint vehicles_last_oil_odometer_nonnegative check (last_oil_change_odometer is null or last_oil_change_odometer >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicles_next_oil_odometer_nonnegative') then
    alter table public.vehicles add constraint vehicles_next_oil_odometer_nonnegative check (next_oil_change_odometer is null or next_oil_change_odometer >= 0);
  end if;
end $$;

create or replace function public.driver_update_vehicle_tracking(
  p_vehicle_id uuid,
  p_registration_expiry date default null,
  p_insurance_expiry date default null,
  p_road_fee_expiry date default null,
  p_last_oil_change_date date default null,
  p_last_oil_change_odometer integer default null,
  p_next_oil_change_date date default null,
  p_next_oil_change_odometer integer default null,
  p_next_maintenance_date date default null,
  p_next_maintenance_odometer integer default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.vehicles;
  allowed boolean;
begin
  select public.current_role() = 'driver' and (
    v.regular_driver_id = auth.uid() or exists (
      select 1 from public.trips t
      where t.vehicle_id = v.id and t.driver_id = auth.uid()
        and t.status in ('assigned','accepted','ready','active')
    )
  ) into allowed
  from public.vehicles v where v.id = p_vehicle_id;

  if not coalesce(allowed, false) then
    raise exception 'Tài xế chỉ được cập nhật xe đang được phân công.' using errcode = '42501';
  end if;
  if p_last_oil_change_odometer is not null and p_last_oil_change_odometer < 0 then raise exception 'KM thay nhớt không hợp lệ.'; end if;
  if p_next_oil_change_odometer is not null and p_next_oil_change_odometer < 0 then raise exception 'Mốc KM thay nhớt không hợp lệ.'; end if;
  if p_next_maintenance_odometer is not null and p_next_maintenance_odometer < 0 then raise exception 'Mốc KM bảo dưỡng không hợp lệ.'; end if;
  if p_last_oil_change_date is not null and p_next_oil_change_date is not null and p_next_oil_change_date < p_last_oil_change_date then
    raise exception 'Ngày thay nhớt kế tiếp phải sau lần thay nhớt gần nhất.';
  end if;

  update public.vehicles set
    registration_expiry = p_registration_expiry,
    insurance_expiry = p_insurance_expiry,
    road_fee_expiry = p_road_fee_expiry,
    last_oil_change_date = p_last_oil_change_date,
    last_oil_change_odometer = p_last_oil_change_odometer,
    next_oil_change_date = p_next_oil_change_date,
    next_oil_change_odometer = p_next_oil_change_odometer,
    next_maintenance_date = p_next_maintenance_date,
    next_maintenance_odometer = p_next_maintenance_odometer
  where id = p_vehicle_id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.driver_update_vehicle_tracking(uuid,date,date,date,date,integer,date,integer,date,integer) from public;
grant execute on function public.driver_update_vehicle_tracking(uuid,date,date,date,date,integer,date,integer,date,integer) to authenticated;
