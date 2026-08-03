# CHANGELOG v1.3.1

- Sửa lỗi Supabase/PostgreSQL `42P17: functions in index expression must be marked IMMUTABLE`.
- Thêm cột `trips.scheduled_period` kiểu `tstzrange`.
- Thêm trigger `trips_sync_scheduled_period` để tự đồng bộ khoảng thời gian chuyến.
- Exclusion constraint chống trùng xe và tài xế giờ chỉ index cột `scheduled_period`.
- Thêm migration nhanh `supabase/fix-trip-overlap.sql` dành cho project đã chạy dở schema v1.3.0.
- Không thay đổi frontend, không cần chạy lại npm install.
