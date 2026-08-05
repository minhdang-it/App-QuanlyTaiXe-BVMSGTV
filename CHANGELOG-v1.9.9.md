# CHANGELOG v1.9.9

## Giao diện đăng nhập mới

- Thiết kế lại màn hình đăng nhập theo mẫu giao diện xanh hiện đại.
- Thay logo cũ bằng nhận diện màu xanh của Bệnh viện Mắt Sài Gòn Trà Vinh.
- Cập nhật logo tại màn hình đăng nhập, thanh thương hiệu, biểu tượng PWA và thông báo trình duyệt.
- Khối đăng nhập được bố trí gọn, rõ, không phát sinh cuộn ngang trên mobile.
- Bổ sung thẻ “Hệ thống bảo mật cao” ở cuối form đăng nhập.
- Giữ đầy đủ chức năng đăng nhập, ghi nhớ số điện thoại, hiện/ẩn mật khẩu và quên mật khẩu.

## Khu vực hình ảnh bên phải

- Thay toàn bộ phần hero bằng hình ảnh thiết kế mới theo mẫu đã duyệt.
- Hình ảnh gồm bệnh viện, xe Hiace 16 chỗ và Fortuner 7 chỗ.
- Bổ sung lớp nền mờ để hình ảnh luôn lấp đầy khung nhưng không bị cắt mất nội dung chính.
- Thêm hiệu ứng nhấp nháy tại trạng thái “Hệ thống trực tuyến”.

## Mobile và PWA

- Trên mobile ưu tiên hiển thị form đăng nhập; hình hero được ẩn để thao tác nhanh và tránh xê dịch chiều ngang.
- Nâng cache Service Worker lên `v199` để trình duyệt nhận logo và giao diện mới.
