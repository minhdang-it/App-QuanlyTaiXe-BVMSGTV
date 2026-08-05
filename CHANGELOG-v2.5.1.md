# CHANGELOG v2.5.1

## Theo dõi vị trí xe gần thời gian thực
- Tài xế dùng `watchPosition` để theo dõi thay đổi GPS liên tục khi chuyến ở trạng thái Đang chạy.
- Tọa độ được gửi khi xe di chuyển tối thiểu khoảng 8 mét và cách lần gửi trước ít nhất 12 giây.
- Có bản tin duy trì tối đa 45 giây và kiểm tra dự phòng mỗi 60 giây.
- Tách riêng thao tác cập nhật GPS để không tải lại toàn bộ giao diện tài xế sau mỗi lần gửi.

## Bản đồ dành cho các bộ phận quản lý
- Điều phối, Kế toán, Đội xe, Ban lãnh đạo và Quản trị có thể theo dõi chuyến đang chạy.
- Bản đồ tự cập nhật khi Supabase Realtime nhận thay đổi từ bảng `trips`.
- Biểu tượng vị trí xe sử dụng logo Bệnh viện Mắt Sài Gòn Trà Vinh.
- Hiển thị biển số, tài xế, điểm đến, tọa độ và độ mới của dữ liệu GPS.

## Cơ sở dữ liệu
- Thêm file `supabase/migrate-v2.5.1-realtime-location.sql` để bảo đảm bảng `trips` được bật trong publication `supabase_realtime`.
