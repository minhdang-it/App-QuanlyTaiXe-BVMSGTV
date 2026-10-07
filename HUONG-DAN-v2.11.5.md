# HƯỚNG DẪN v2.11.5 – OPENSTREETMAP

## Thay đổi chính

- Màn Theo dõi xe realtime sử dụng OpenStreetMap hoàn toàn, không cần Google Maps API Key.
- Bản đồ có nút `+`, `−`, căn lại và toàn màn hình.
- Có thể kéo bản đồ bằng chuột hoặc ngón tay.
- Marker xe cập nhật theo GPS Navicom mỗi chu kỳ polling.
- Trạng thái Đang chạy ưu tiên tốc độ Navicom; nếu CMSV6 trả tốc độ 0 nhưng tọa độ thay đổi đủ lớn, hệ thống vẫn xác định xe đang di chuyển.
- Camera mobile vẫn hỗ trợ phóng to ngang.

## Cấu hình frontend

Không còn khai báo `VITE_GOOGLE_MAPS_API_KEY`. Chỉ giữ:

```env
VITE_NAVICOM_GATEWAY_URL=/api/navicom
```

## Kiểm tra trước build

```cmd
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```
