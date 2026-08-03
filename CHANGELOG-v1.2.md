# MSG Car Web v1.2.0 — Sửa lưu KM và OCR tự điền

## Đã sửa

- Khắc phục lỗi ảnh camera dung lượng lớn làm chế độ Demo vượt giới hạn `localStorage`, dẫn đến không lưu được KM đầu.
- Ảnh được tự động xoay đúng chiều, thu nhỏ và nén JPEG trước khi lưu hoặc upload.
- Ảnh Demo được lưu dạng Blob trong IndexedDB; dữ liệu nghiệp vụ trong `localStorage` chỉ giữ mã tham chiếu.
- Thông báo lỗi lưu ảnh/KM nay hiển thị nổi phía trên modal, không còn bị che phía sau cửa sổ chụp ảnh.
- Thông báo rõ lỗi thiếu bucket, sai Storage Policy, không đủ quyền hoặc ảnh vượt dung lượng.
- Sửa kiểm tra KM dùng `null` thay vì kiểm tra truthy, tránh nhận sai trạng thái khi giá trị là 0.

## Đã bổ sung

- OCR Tesseract.js chạy trực tiếp trên trình duyệt.
- Tự tiền xử lý ảnh: xoay, grayscale, kéo tương phản và tự đảo màu khi cụm đồng hồ tối.
- Chỉ nhận dạng chữ số và tự chọn dãy ODO hợp lý dựa trên kilomet hiện tại của xe.
- Tự điền số KM vào ô xác nhận ngay sau khi chụp.
- Hiển thị tiến trình OCR, độ tin cậy và cảnh báo khi số đọc chênh lệch bất thường.
- Cho phép tài xế sửa thủ công trước khi lưu; không tự lưu số OCR khi chưa xác nhận.

## Cập nhật từ v1.1

Không cần thay đổi database.

```bash
npm install
npm run verify
npm run build
```

Sau khi deploy, đổi Service Worker lên cache `dieu-phoi-xe-bvmsgtv-shell-v3`. Trên điện thoại cần đóng PWA, mở lại và tải lại trang. Nếu vẫn còn bản cũ, xóa dữ liệu website hoặc gỡ biểu tượng PWA rồi cài lại.
