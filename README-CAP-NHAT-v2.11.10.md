# BVMSGTV v2.11.10 — Bản đồ đội xe mượt trên mobile

## Vì sao bị giật và mất nền?

Bản đồ `Theo dõi xe` cũ tự ghép khoảng 49 ảnh PNG OpenStreetMap, thay đổi React state liên tục khi kéo, chụm ngón tay hoặc nhận GPS. Điều này dễ gây trống/giật tile trên iOS.

## Điểm sửa

- Thay bản đồ tự dựng bằng Leaflet (engine map phổ biến), vẫn dùng **dữ liệu OpenStreetMap**.
- Trên mobile kéo mượt bằng ngón tay và phóng to/thu nhỏ bằng **2 ngón tay**.
- Desktop: **Ctrl + lăn chuột** để zoom; cuộn chuột thường cuộn trang.
- Zoom +/−, căn lại đội xe, fullscreen (nếu trình duyệt hỗ trợ), nút bám theo xe được chọn.
- Marker xe nhận vị trí Navicom như cũ nhưng cập nhật bằng `marker.setLatLng()`, không khởi tạo lại bản đồ mỗi chu kỳ.
- Chỉ fit bounds lần đầu, không tự giật bản đồ về trung tâm khi đang dùng.
- `ResizeObserver` xử lý bản đồ khi đổi kích thước màn hình/điện thoại.
- Ảnh nền mặc định dùng CARTO Light dựa trên dữ liệu OSM để giảm lỗi tải ô bản đồ; nếu CARTO lỗi thì tự chuyển sang OpenStreetMap tile server. Ghi nguồn OSM/CARTO ở chân bản đồ.

## Cài đặt

1. **Giải nén patch**. Không chạy script trong thư mục patch.
2. **Copy nguyên thư mục** `BVMSGTV-v2.11.10-SMOOTH-OSM-MAP-PATCH` hoặc ít nhất 3 file `APPLY-v2.11.10.mjs`, `src/components/FleetSmoothMap.tsx`, `src/styles/fleet-smooth-map.css` vào thư mục full source hiện tại (giữ nguyên cấu trúc thư mục).
3. Mở CMD trong thư mục full source, chạy:

```bat
node APPLY-v2.11.10.mjs
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

4. Upload `dist` mới lên Ubuntu và deploy như quy trình hiện tại.
5. Test trên iPhone: kéo bằng một ngón, zoom bằng hai ngón, chuyển xe theo marker, đợi GPS cập nhật để kiểm tra bản đồ **không bị kéo về giữa**.

## Kết nối Internet

Leaflet CSS/JS được tải qua CDNJS, dự phòng unpkg; **không cần cài thêm npm package**. Các CDN phải được trình duyệt truy cập được. Khi cần vận hành không phụ thuộc CDN, hãy đóng gói `leaflet.js` và `leaflet.css` nội bộ trong `public/vendor/leaflet` rồi đổi URL ở `FleetSmoothMap.tsx`.

## Cấu hình tile (tùy chọn)

Bạn có thể thay bản đồ nền tại thời điểm build bằng `VITE_OSM_TILE_URL`. Đây là cấu hình URL **không chứa khóa bí mật**. Mặc định CARTO Light với dữ liệu OSM, tự dự phòng sang tile.openstreetmap.org nếu CARTO không phản hồi.

## Giới hạn

Không thể kiểm chứng giao diện thật trên thiết bị iOS và Navicom production trong môi trường tạo bản vá. Nếu màn hình vẫn trống, kiểm tra Network xem trình duyệt có tải được CDNJS/unpkg và CARTO/OSM không, hoặc gửi console lỗi. Không có migration cơ sở dữ liệu.
