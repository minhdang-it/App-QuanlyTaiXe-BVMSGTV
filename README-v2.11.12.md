# BVMSGTV v2.11.12 — Thẻ xe tương tác

## Tính năng

1. Chạm vào **Tốc độ** trên card: xem đồng hồ km/h cỡ lớn, trạng thái và thời gian dữ liệu GPS cuối. Giá trị cập nhật theo chu kỳ làm mới Navicom hiện có (~5 giây) khi card vẫn hiển thị.
2. Chạm vào **tên tài xế**: bảng thông tin tài xế (họ tên, bộ phận, mã NV, điện thoại nếu hồ sơ đã khai báo), nút Gọi.
3. Chạm **tọa độ**: mở đúng vĩ độ/kinh độ trên Google Maps ở tab mới. Bản đồ chính trong ứng dụng vẫn dùng OpenStreetMap.
4. Xe offline vẫn xem được tốc độ/vị trí cuối, nhưng giao diện ghi rõ là dữ liệu cũ.
5. Giữ thao tác bấm vào phần còn lại của card để chọn xe theo dõi.

## Cài trên Windows (khuyến nghị)

**A.** Tải `BVMSGTV-v2.11.12-FLEET-CARD-INTERACTIONS.zip` rồi **copy ZIP vào thư mục FULL SOURCE** (nơi có `package.json` và `src/`).

**B.** Mở CMD ở chính thư mục FULL SOURCE, nhập:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath '.\BVMSGTV-v2.11.12-FLEET-CARD-INTERACTIONS.zip' -DestinationPath '.\PATCH-v2.11.12' -Force"
dir ".\PATCH-v2.11.12\APPLY-v2.11.12.mjs"
node ".\PATCH-v2.11.12\APPLY-v2.11.12.mjs"
npm.cmd run verify:source
npm.cmd run check
npm.cmd run build
```

Script **tự backup** vào `_backup-v2.11.12-...` và chỉ thay:
- `src/pages/TrackingPage.tsx`
- `src/components/FleetVehicleCard.tsx` (mới)
- `src/styles/fleet-card-interactions.css` (mới)
- `src/styles.css`
- `package.json` / `package-lock.json` (bump version)
- `public/sw.js` (cache)

Nếu script không nhận diện được `VehicleLiveCard`, nó **dừng trước khi sửa**. Lúc này hãy gửi `src/pages/TrackingPage.tsx` đang dùng để tích hợp trực tiếp.

## Lưu ý

- Không chạy SQL migration, không cập nhật Navicom Gateway.
- Không cần Google Maps API key: chỉ mở link `google.com/maps` khi người dùng bấm tọa độ.
- Vị trí và tốc độ mới nhất phụ thuộc dữ liệu GPS Navicom trên server và chu kỳ polling đang cấu hình.
