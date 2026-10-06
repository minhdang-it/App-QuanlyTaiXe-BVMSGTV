-- CHỈ KIỂM TRA, KHÔNG THAY ĐỔI DỮ LIỆU.
-- Chạy trong Supabase SQL Editor nếu cần xác nhận database đã ở flow v2.9+.

select 'user_presence table' as muc,
       case when to_regclass('public.user_presence') is not null then 'OK' else 'THIEU' end as trang_thai;

select 'trips.is_adhoc' as muc,
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='trips' and column_name='is_adhoc'
       ) then 'OK' else 'THIEU' end as trang_thai;

select status, count(*) as so_chuyen
from public.trips
group by status
order by status;

-- Flow mới không tạo thêm chuyến pending_director. Nếu còn dữ liệu cũ, migration v2.9.0 sẽ chuyển sang assigned.
select count(*) as chuyen_cu_con_cho_bgđ
from public.trips
where status = 'pending_director';

select is_adhoc, adhoc_report_status, count(*)
from public.trips
group by is_adhoc, adhoc_report_status
order by is_adhoc, adhoc_report_status;
