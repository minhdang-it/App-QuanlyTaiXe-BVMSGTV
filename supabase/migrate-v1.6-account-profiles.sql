-- Điều phối xe BVMSGTV v1.6.0
-- Nâng cấp hồ sơ tài khoản: ảnh đại diện, mã nhân viên, phòng ban, chức danh, ghi chú.
-- Chạy một lần trong Supabase SQL Editor.

begin;

alter table public.profiles
  add column if not exists employee_code text,
  add column if not exists department text,
  add column if not exists job_title text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Chỉ quản trị viên đang hoạt động được sửa hồ sơ người dùng.
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
on public.profiles for update to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Admin được tải/cập nhật avatar vào thư mục của tài khoản đích.
-- Đường dẫn: <user-id>/avatars/profile.jpg
drop policy if exists "media upload own folder" on storage.objects;
create policy "media upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (public.current_role() = 'admin' and (storage.foldername(name))[2] = 'avatars')
  )
);

drop policy if exists "media update own folder" on storage.objects;
create policy "media update own folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (public.current_role() = 'admin' and (storage.foldername(name))[2] = 'avatars')
  )
)
with check (
  bucket_id = 'vehicle-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (public.current_role() = 'admin' and (storage.foldername(name))[2] = 'avatars')
  )
);

-- Audit thay đổi hồ sơ nếu function audit_change đã tồn tại.
do $$
begin
  if to_regprocedure('public.audit_change()') is not null then
    drop trigger if exists audit_profiles on public.profiles;
    create trigger audit_profiles
    after insert or update or delete on public.profiles
    for each row execute function public.audit_change();
  end if;
end $$;

-- Bật realtime cho danh sách tài khoản.
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

commit;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('avatar_url','employee_code','department','job_title','notes','updated_at')
order by column_name;
