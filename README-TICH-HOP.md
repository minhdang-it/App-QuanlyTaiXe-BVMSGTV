# Patch TypeScript v2.11.16 — Marker ảnh xe và hoạt động gần đây

Đây là SOURCE PATCH, **không phải full source ứng dụng bệnh viện**. Tài liệu này đi kèm một bản source React/Vite demo độc lập dùng để test local. Muốn tạo full source production mới đúng với nghiệp vụ hiện tại, cần source ZIP v2.11.15 do bạn đang phát triển trên Windows.

## File chỉnh
- `src/components/FleetSmoothMap.tsx`: mã nguồn component Leaflet có ảnh xe, viền trạng thái, ảnh fallback Hiace/Fortuner, cập nhật marker thay vì dựng lại map.
- `src/styles/fleet-smooth-map.css`: CSS nền map và tương tác.
- `src/styles/fleet-marker-visual.css`: CSS marker ảnh to, căn tâm, và chữ Hoạt động gần đây.
- `public/hiace-real.png`, `public/fortuner-real.png`: ảnh xe thực tế độ phân giải cao.

## Cách tích hợp vào full source khi có
1. Sao lưu full source.
2. Đối chiếu `TrackingPage.tsx` của bản mới. **Không chép đè nguyên trang cũ** để tránh mất nhật ký GPS/tương tác thẻ xe.
3. Nếu đã import `FleetSmoothMap` từ một component riêng, thay nội dung file tương ứng bằng file patch; nếu map đang inline trong TrackingPage, tách component hoặc gửi source để ghép đúng.
4. Đảm bảo nạp CSS `fleet-smooth-map.css` và `fleet-marker-visual.css` SAU CSS cũ trong entrypoint.
5. Đảm bảo `items` truyền vào map chứa `vehicle.id`, `vehicle.plate_number`, `vehicle.image_url`, `state.gps.lat/lng` và `status`.
6. Chạy `npm.cmd run verify:source`, `npm.cmd run check`, `npm.cmd run build`.

## Trạng thái
- Đang chạy: xanh dương; Đang dừng: xanh lá; Chậm cập nhật: cam; Offline: đỏ.
- Ảnh xe giữ độ nét: khung tròn 80px, ảnh căn giữa bằng CSS, không làm mờ ảnh offline (chỉ vòng màu biểu thị trạng thái).
- Hoạt động gần đây: tên sự kiện 15px, tọa độ 13px, thời gian 12px. Mobile tự dời thời gian xuống dòng.

Không cần SQL hoặc sửa Navicom Gateway. Bản vá này chỉ liên quan giao diện.
