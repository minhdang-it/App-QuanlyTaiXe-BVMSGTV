# Cập nhật v2.8.0

## 1. Điều kiện
- Đã ở phiên bản v2.7.15 hoặc đã có đầy đủ migration đến v2.7.12.
- Không cần chạy SQL mới cho v2.8.0.
- Không cần deploy lại `manage-user`.

## 2. Build trên Windows
```powershell
npm run verify:source
npm run check
npm run build
```

## 3. Deploy
Upload thư mục `dist` lên Ubuntu, sau đó chạy script deploy static hiện tại.

## 4. Kiểm tra mobile trước
- Dashboard Hôm nay.
- Việc cần xử lý theo đúng vai trò.
- Bấm một thông báo và xác nhận hệ thống mở/cuộn đúng bản ghi.
- Lịch Ngày/Tuần/Tháng.
- Tài xế: thanh tiến độ, cảnh báo xe, bắt đầu chuyến, chế độ tập trung khi đang chạy.
- Offline: tắt mạng, tạo dữ liệu được hỗ trợ, bật mạng và bấm Đồng bộ ngay.
- Tìm kiếm toàn hệ thống.
- Kiểm tra mọi ngày theo `DD/MM/YYYY`, ngày giờ theo `DD/MM/YYYY HH:mm`.

## 5. Lưu ý PWA
Service Worker đã đổi cache sang v2.8.0. Sau deploy, nếu điện thoại còn giao diện cũ, đóng hoàn toàn PWA/trình duyệt rồi mở lại. Nếu vẫn còn cache cũ, xóa dữ liệu website một lần.
