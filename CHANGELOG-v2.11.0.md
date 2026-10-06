# CHANGELOG v2.11.0 — Trung tâm điều hành đội xe Navicom

## 1. Tổng quan đội xe
- Thêm trang mới: **Theo dõi xe realtime** tại `/theo-doi-xe`.
- KPI: Tổng số xe, Online, Đang chạy, Đang dừng, Mất tín hiệu, Cảnh báo.

## 2. Danh sách xe realtime
- Card từng xe: biển số, tên xe, trạng thái, tốc độ, tài xế, vị trí, thời gian cập nhật.
- Lọc: Tất cả / Online / Đang chạy / Đang dừng / Mất tín hiệu / Cảnh báo.
- Tìm kiếm nhanh theo biển số, tài xế, vị trí.

## 3. GPS Navicom realtime
- Bản đồ đội xe hiển thị đồng thời nhiều xe bằng dữ liệu lat/lng từ Navicom.
- Marker đổi màu theo trạng thái và tự cập nhật mỗi 5 giây.
- Bấm marker để chọn xe và mở chi tiết.
- Không dùng GPS điện thoại tài xế.

## 4. Camera trước + Camera cabin cùng lúc
- Mỗi xe chỉ dùng tối đa 2 kênh: Camera trước và Camera cabin.
- PC: hiển thị song song 2 camera.
- Mobile: xếp dọc, có chế độ Cả 2 / Camera trước / Camera cabin.
- Áp dụng cả trong NavicomMonitor cũ và trang Theo dõi xe mới.

## 5. Thông báo trạng thái Navicom
- Watcher chạy nền trong toàn app cho BGĐ / Hành chính / Điều phối / Quản trị.
- Gửi thông báo khi: xe vừa online, mất tín hiệu, bắt đầu di chuyển, đã dừng.
- Không spam theo mỗi lần poll; chỉ thông báo khi trạng thái thay đổi.
- Không coi lỗi Gateway/mạng là xe offline để tránh cảnh báo giả.

## 6. Cảnh báo vận hành
- Cảnh báo GPS cập nhật chậm.
- Cảnh báo đăng kiểm, bảo hiểm TNDS, phí đường bộ, bảo dưỡng sắp tới hạn hoặc quá hạn.

## 7. Phân quyền
- Có quyền Theo dõi xe realtime: Ban Giám đốc, Hành chính, Điều phối, Quản trị.
- Không cấp quyền: Tài xế, Kế toán, Trưởng khoa/Trưởng phòng.

## Kỹ thuật
- Không cần SQL mới.
- Không cần cập nhật Gateway nếu đang dùng Gateway v2.10.9 single-camera đúng 2 kênh.
- Service Worker cache đã tăng version.
