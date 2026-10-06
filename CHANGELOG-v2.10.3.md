# v2.10.3 – Navicom Local Easy

- Sửa script START-LOCAL-NAVICOM trên Windows và tách START-NAVICOM-GATEWAY.
- Thêm CHECK-NAVICOM-GATEWAY và npm scripts kiểm tra cấu hình/health.
- `.env.navicom.local.example` mặc định MOCK để test ngay.
- `/health` public nhưng không trả GPS/camera, giúp chẩn đoán gateway dễ hơn.
- Giao diện phân biệt rõ: chưa bật Navicom vs thiếu Device ID/IMEI.
- Hiển thị cảnh báo khi đang ở chế độ mô phỏng.
- Giữ flow tài xế tối giản, không GPS điện thoại, không Google Maps, không chụp tổng quan xe.
