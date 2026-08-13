# v2.7.6 – Theo dõi xe cho tài xế

- Tài xế có nút **Theo dõi xe** trên mobile.
- Cập nhật hạn Bảo hiểm TNDS, Đăng kiểm, Phí sử dụng đường bộ.
- Cập nhật lần thay nhớt gần nhất/kế tiếp theo ngày và kilomet.
- Cập nhật mốc bảo dưỡng kế tiếp.
- Cảnh báo giấy tờ, thay nhớt trên Tổng quan.
- RPC Supabase giới hạn tài xế chỉ cập nhật xe đang được phân công.
- Chuẩn hóa các ô ngày chính sang DD/MM/YYYY và ngày giờ sang DD/MM/YYYY HH:mm.

## Bắt buộc
Chạy `supabase/migrate-v2.7.6-driver-vehicle-tracking.sql` trước khi deploy frontend.
