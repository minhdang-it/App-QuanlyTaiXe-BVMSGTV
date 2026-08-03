# Điều phối xe BVMSGTV v1.3.0 — Xác nhận GPS và Google Maps

## Thay đổi giao diện đăng nhập

- Xóa hoàn toàn khu vực **Chọn nhanh tài khoản**.
- Không tự điền số điện thoại hoặc mật khẩu khi mở trang.
- Chế độ Demo vẫn hoạt động nhưng người dùng phải nhập tài khoản thủ công.

## Thay đổi luồng bắt đầu chuyến

- Sau khi checklist hợp lệ và đã lưu KM đầu, tài xế bấm **Bắt đầu chuyến**.
- Website tự yêu cầu quyền GPS và hiển thị:
  - Điểm đón.
  - Điểm đến.
  - Tọa độ hiện tại.
  - Sai số GPS tham khảo.
- Tài xế phải tích xác nhận đang ở điểm đón trước khi bắt đầu.
- Vị trí xác nhận được lưu vào `start_lat` và `start_lng` của chuyến.
- Sau khi chuyển trạng thái sang `active`, website tự mở Google Maps với:
  - Điểm bắt đầu là GPS hiện tại.
  - Điểm đến là trường `destination` của chuyến.
  - Chế độ di chuyển bằng ô tô.
- Trong chuyến đang chạy có thêm nút **Tiếp tục dẫn đường Google Maps**.
- Chi tiết chuyến có thêm nút mở tuyến đường Google Maps.

## Điều kiện hoạt động

- GPS cần website chạy bằng HTTPS hoặc `localhost`.
- Trình duyệt phải được cấp quyền Vị trí.
- Không cần Google Maps API key.
- Không cần cập nhật schema Supabase hoặc chạy lại SQL.

## Cache PWA

- Tăng Service Worker cache lên `dieu-phoi-xe-bvmsgtv-shell-v5`.
