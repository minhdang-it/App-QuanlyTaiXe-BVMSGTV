begin;

alter table public.expenses
  add column if not exists director_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists director_reviewed_at timestamptz,
  add column if not exists accountant_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists accountant_reviewed_at timestamptz,
  add column if not exists paid_by uuid references public.profiles(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.expenses drop constraint if exists expenses_status_check;

update public.expenses
set status = 'pending_director'
where status = 'pending';

alter table public.expenses
  alter column status set default 'pending_director',
  add constraint expenses_status_check
  check (status in ('pending_director','pending_accountant','approved','rejected','paid'));

create or replace function public.can_review_expense()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('director','accountant','admin'), false);
$$;

create or replace function public.protect_expense_workflow()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  role_name text := public.current_role();
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending_director' and new.status = 'pending_accountant' and role_name in ('director','admin') then
    return new;
  end if;

  if old.status = 'pending_accountant' and new.status = 'approved' and role_name in ('accountant','admin') then
    return new;
  end if;

  if old.status = 'approved' and new.status = 'paid' and role_name in ('accountant','admin') then
    return new;
  end if;

  if new.status = 'rejected' and (
    (old.status = 'pending_director' and role_name in ('director','admin'))
    or (old.status = 'pending_accountant' and role_name in ('accountant','admin'))
  ) then
    if coalesce(trim(new.rejection_reason), '') = '' then
      raise exception 'Cần nhập lý do từ chối chi phí';
    end if;
    return new;
  end if;

  raise exception 'Chuyển trạng thái chi phí không hợp lệ hoặc không đúng thẩm quyền';
end;
$$;

drop trigger if exists protect_expense_workflow on public.expenses;
create trigger protect_expense_workflow
before update on public.expenses
for each row execute function public.protect_expense_workflow();

drop policy if exists "expenses accountant update" on public.expenses;
drop policy if exists "expenses approval update" on public.expenses;
create policy "expenses approval update"
on public.expenses
for update
to authenticated
using (public.can_review_expense())
with check (public.can_review_expense());

commit;
