# Cập nhật v2.11.2

## Nếu đang dùng v2.11.0
1. Chép patch v2.11.2 đè vào source.
2. Chạy migration `supabase/migrate-v2.11.1-fleet-approval-repair.sql` một lần trong Supabase SQL Editor.
3. Chạy `npm.cmd run verify:source`, `npm.cmd run check`, `npm.cmd run build`.
4. Deploy lại `dist`.

## Thông báo Navicom
- Online chỉ thông báo khi xe đã ở trạng thái offline rồi quay lại online.
- Trạng thái GPS “cập nhật chậm” không còn tạo thông báo online mới.
- Có cooldown chống lặp khi mạng/GPS chập chờn.
