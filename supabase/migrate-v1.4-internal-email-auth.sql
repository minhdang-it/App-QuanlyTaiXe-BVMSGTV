-- Điều phối xe BVMSGTV v1.4.0
-- Chuyển cơ chế xác thực từ Phone Auth sang Email nội bộ ẩn.
-- Chạy file này trên project Supabase đang sử dụng trước khi deploy frontend v1.4.0.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Người dùng'),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    'driver'
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    phone = case when excluded.phone <> '' then excluded.phone else public.profiles.phone end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chỉ tạo unique index khi dữ liệu hiện tại không bị trùng số điện thoại.
do $$
begin
  if exists (
    select 1
    from public.profiles
    where phone <> ''
    group by phone
    having count(*) > 1
  ) then
    raise warning 'Chưa tạo profiles_phone_unique vì đang có số điện thoại trùng trong public.profiles.';
  else
    execute $sql$create unique index if not exists profiles_phone_unique on public.profiles(phone) where phone <> ''$sql$;
  end if;
end $$;

-- Kiểm tra nhanh kết quả.
select
  count(*) filter (where phone <> '') as profiles_co_so_dien_thoai,
  count(distinct phone) filter (where phone <> '') as so_dien_thoai_khong_trung
from public.profiles;
