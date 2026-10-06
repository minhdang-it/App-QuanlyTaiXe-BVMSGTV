# Sửa lỗi Hành chính duyệt chuyến – v2.11.1

1. Vào Supabase → SQL Editor.
2. Chạy toàn bộ file `supabase/migrate-v2.11.1-fleet-approval-repair.sql`.
3. Build frontend mới: `npm.cmd run verify:source`, `npm.cmd run check`, `npm.cmd run build`.
4. Deploy `dist` lên Ubuntu.
5. Đăng nhập Hành chính hoặc Quản trị và thử lại nút **Hành chính duyệt & giao tài xế**.

Không cần sửa dữ liệu chuyến hiện có. Migration hỗ trợ cả `pending_fleet` và `pending_director` cũ.
