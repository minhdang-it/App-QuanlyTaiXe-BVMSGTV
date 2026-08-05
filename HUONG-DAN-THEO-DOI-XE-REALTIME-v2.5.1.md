# Hướng dẫn theo dõi xe gần thời gian thực

## 1. Cập nhật Supabase

Mở Supabase Dashboard → SQL Editor và chạy:

```text
supabase/migrate-v2.5.1-realtime-location.sql
```

## 2. Điều kiện trên điện thoại tài xế

- Mở ứng dụng bằng HTTPS.
- Cho phép quyền Vị trí chính xác.
- Không tắt GPS khi chuyến đang chạy.
- Không buộc dừng ứng dụng/PWA.
- Nên tắt tối ưu pin riêng cho ứng dụng trình duyệt hoặc PWA trên thiết bị tài xế.

## 3. Cách hoạt động

Khi tài xế bấm Bắt đầu chuyến, ứng dụng theo dõi GPS. Khi xe thay đổi vị trí, tọa độ được ghi vào chuyến đang chạy. Các tài khoản quản lý nhận sự kiện Supabase Realtime và cập nhật màn hình giám sát.

## 4. Phân quyền xem vị trí

Các vai trò được xem chuyến và vị trí xe:

- Điều phối
- Kế toán
- Đội xe
- Ban lãnh đạo
- Quản trị

Tài xế chỉ xem và cập nhật chuyến của chính mình.

## 5. Giới hạn của ứng dụng web

GPS hoạt động tốt khi PWA đang mở hoặc vẫn được hệ điều hành cho chạy. Một số điện thoại Android có thể tạm dừng JavaScript khi tắt màn hình hoặc bật tiết kiệm pin. Muốn theo dõi liên tục tuyệt đối kể cả khi ứng dụng bị đóng cần phát triển ứng dụng Android native có dịch vụ định vị nền.
