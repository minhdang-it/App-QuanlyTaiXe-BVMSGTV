# BVMSGTV v2.11.11 — sửa lỗi “API KEY REQUIRED” trên bản đồ Leaflet

## Nguyên nhân

V2.11.10 dùng CARTO Light làm nguồn ảnh nền mặc định. Nhà cung cấp hiện phản hồi các ô ảnh chứa chữ `API KEY REQUIRED`; HTTP vẫn có thể là 200 nên bộ đếm `tileerror` không tự chuyển sang nhà cung cấp khác.

## Cách khắc phục

- Chuyển **hẳn** sang `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (không cần Google Maps API Key hoặc CARTO Key).
- Gỡ bỏ cấu hình `VITE_OSM_TILE_URL` tại component (kể cả cấu hình môi trường cũ, tránh quay về CARTO).
- Giữ engine Leaflet: bản đồ chỉ khởi tạo một lần, marker GPS được cập nhật khi nhận dữ liệu Navicom.
- Ctrl + cuộn chuột trên desktop; kéo và zoom 2 ngón tay trên mobile.
- Khi mạng không tải được tile, hiện thông báo rõ ràng, không nhầm với lỗi GPS.

## Cài đặt (Windows CMD)

1. Giải nén ZIP.
2. Copy nguyên thư mục `BVMSGTV-v2.11.11-OPENSTREETMAP-TILE-FIX` vào thư mục FULL SOURCE hiện đang sử dụng (bên cạnh `src`, `public`, `package.json`).
3. Tại thư mục full source chạy:

```cmd
node BVMSGTV-v2.11.11-OPENSTREETMAP-TILE-FIX/APPLY-v2.11.11.mjs
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

4. Deploy `dist` mới lên Ubuntu theo quy trình đang sử dụng.
5. Trên iPhone/iPad: đóng tab ứng dụng, mở lại hoặc tải lại trang; nếu bản cũ vẫn hiện, kiểm tra service worker/cache bản cũ.

## Kiểm tra

- Không còn chữ `API KEY REQUIRED` hay chữ CARTO trên bản đồ.
- Xe vẫn nằm đúng tọa độ GPS Navicom.
- Zoom PC Ctrl + cuộn, mobile chụm 2 ngón tay.
- Chọn xe khác và chờ 2-3 chu kỳ GPS: bản đồ không bị dựng lại hoặc giật về vị trí mặc định.

## Lưu ý vận hành

`tile.openstreetmap.org` là dịch vụ công cộng, áp dụng [chính sách sử dụng ô bản đồ](https://operations.osmfoundation.org/policies/tiles/). Không dùng để tải/tiền tải số lượng lớn. Nếu triển khai cho nhiều người dùng đồng thời, nên cấu hình nhà cung cấp tile chuyên dụng có giới hạn và điều khoản phù hợp hoặc tự triển khai máy chủ tile riêng. Không cần sửa dữ liệu, Gateway Navicom, camera hoặc phân quyền.
